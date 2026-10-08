"""Create, find, and change meetings independently of HTTP routing."""

import re
import secrets
import hashlib
import hmac
from urllib.parse import unquote, urlsplit

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Meeting, Participant
from app.schemas.meeting import InstantMeetingCreate, MeetingResponse, ScheduledMeetingCreate
from app.utils.errors import fail
from app.utils.security import hash_secret, matches_secret, new_secret
from app.utils.time import utc_now


def generate_meeting_code() -> str:
    return str(10_000_000_000 + secrets.randbelow(90_000_000_000))


def normalize_code(value: str) -> str:
    code = re.sub(r"[\s-]", "", value)
    if not re.fullmatch(r"[0-9]{11}", code):
        fail(422, "INVALID_MEETING_ID", "Enter an 11-digit meeting ID")
    return code


def lookup_code(value: str, settings: Settings) -> str:
    value = value.strip()
    if "://" not in value:
        return normalize_code(value)
    try:
        parsed = urlsplit(value)
    except ValueError:
        fail(422, "INVALID_INVITE_LINK", "Use a valid invite link from this Zoom clone")
    origin = urlsplit(settings.frontend_url)
    match = re.fullmatch(r"/(?:join|meeting)/([^/]+)/?", parsed.path)
    if (parsed.scheme, parsed.netloc) != (origin.scheme, origin.netloc) or not match:
        fail(422, "INVALID_INVITE_LINK", "Use an invite link from this Zoom clone")
    return normalize_code(unquote(match.group(1)))


def get_meeting(db: Session, code: str) -> Meeting:
    meeting = db.scalar(select(Meeting).where(Meeting.meeting_code == normalize_code(code)))
    if meeting is None:
        fail(404, "MEETING_NOT_FOUND", "This meeting does not exist")
    return meeting


def public_meeting(meeting: Meeting, settings: Settings) -> MeetingResponse:
    # A response schema deliberately excludes database secret-hash columns.
    result = MeetingResponse.model_validate(meeting)
    return result.model_copy(update={"invite_link": f"{settings.frontend_url}/join/{meeting.meeting_code}"})


def require_host(meeting: Meeting, token: str | None) -> None:
    if not token:
        fail(401, "HOST_TOKEN_REQUIRED", "Supply the host token in X-Host-Token")
    if not matches_secret(token, meeting.host_capability_hash):
        fail(403, "HOST_ACCESS_DENIED", "Only this meeting's host can perform this action")


def require_live(meeting: Meeting) -> None:
    if meeting.status == "scheduled":
        fail(409, "WAITING_FOR_HOST", "Waiting for the host to start this meeting")
    if meeting.status == "ended":
        fail(410, "MEETING_ENDED", "This meeting has ended")


def account_host_token(code: str, owner_id: int, settings: Settings) -> str:
    # Recoverable only after account authentication; different from account JWTs.
    return hmac.new(settings.auth_secret.get_secret_value().encode(),
                    f"meeting-host:{owner_id}:{code}".encode(), hashlib.sha256).hexdigest()


def create_meeting(
    db: Session, payload: InstantMeetingCreate | ScheduledMeetingCreate, kind: str, owner_id: int = 1, settings: Settings | None = None
) -> tuple[Meeting, str]:
    host_token = new_secret()
    scheduled = isinstance(payload, ScheduledMeetingCreate)
    for _ in range(5):
        code = generate_meeting_code()
        if owner_id != 1 and settings:
            host_token = account_host_token(code, owner_id, settings)
        meeting = Meeting(
            meeting_code=code,
            host_user_id=owner_id,
            host_capability_hash=hash_secret(host_token),
            title=payload.title,
            description=payload.description,
            kind=kind,
            status="scheduled" if scheduled else "live",
            scheduled_start_at=payload.scheduled_start_at if scheduled else None,
            duration_minutes=payload.duration_minutes if scheduled else None,
            started_at=None if scheduled else utc_now(),
        )
        db.add(meeting)
        try:
            db.commit()
            return meeting, host_token
        except IntegrityError:
            # The unique database constraint handles a simultaneous ID collision.
            db.rollback()
            if db.scalar(select(Meeting.id).where(Meeting.meeting_code == meeting.meeting_code)) is None:
                raise
    fail(503, "MEETING_ID_UNAVAILABLE", "Could not allocate a meeting ID; please retry")


def start_meeting(db: Session, meeting: Meeting, token: str | None) -> Meeting:
    require_host(meeting, token)
    if meeting.status == "ended":
        fail(409, "MEETING_ENDED", "An ended meeting cannot be started again")
    if meeting.status != "live":
        meeting.status = "live"
        meeting.started_at = utc_now()
        db.commit()
    return meeting


def mark_ended(db: Session, meeting: Meeting, token: str | None) -> list[str]:
    require_host(meeting, token)
    participants = db.scalars(select(Participant).where(Participant.meeting_id == meeting.id)).all()
    if meeting.status != "ended":
        meeting.status = "ended"
        meeting.ended_at = utc_now()
        for participant in participants:
            if participant.joined_at is not None and participant.left_at is None:
                participant.left_at = meeting.ended_at
        # Block new join tokens before beginning external room cleanup.
        db.commit()
    return [participant.id for participant in participants]


def upcoming_meetings(db: Session, owner_id: int = 1) -> list[Meeting]:
    return list(db.scalars(select(Meeting).where(
        Meeting.host_user_id == owner_id, Meeting.kind == "scheduled", Meeting.status == "scheduled", Meeting.scheduled_start_at > utc_now()
    ).order_by(Meeting.scheduled_start_at)).all())


def recent_meetings(db: Session, owner_id: int = 1) -> list[Meeting]:
    return list(db.scalars(select(Meeting).where(Meeting.status == "ended", Meeting.host_user_id == owner_id)
        .order_by(Meeting.ended_at.desc()).limit(20)).all())
