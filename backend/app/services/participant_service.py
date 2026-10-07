from uuid import uuid4

from sqlalchemy.orm import Session

from app.models import Meeting, Participant
from app.schemas.participant import JoinMeetingRequest
from app.services.media_service import MediaService
from app.services.meeting_service import require_host, require_live
from app.utils.errors import fail
from app.utils.security import hash_secret, matches_secret, new_secret
from app.utils.time import utc_now


def join_meeting(
    db: Session, meeting: Meeting, payload: JoinMeetingRequest,
    media: MediaService, host_token: str | None,
) -> tuple[Participant, str, str]:
    require_live(meeting)
    if host_token is not None:
        require_host(meeting, host_token)
    media.require_configuration()
    participant_token = new_secret()
    participant = Participant(
        id=str(uuid4()), meeting_id=meeting.id,
        user_id=meeting.host_user_id if host_token is not None else None,
        display_name=payload.display_name,
        role="host" if host_token is not None else "guest",
        session_token_hash=hash_secret(participant_token),
    )
    livekit_token = media.issue_token(meeting, participant)
    db.add(participant)
    db.commit()
    return participant, participant_token, livekit_token


def authorized_participant(
    db: Session, meeting: Meeting, participant_id: str, token: str | None
) -> Participant:
    if not token:
        fail(401, "PARTICIPANT_TOKEN_REQUIRED", "Supply X-Participant-Token")
    participant = db.get(Participant, participant_id)
    if participant is None or participant.meeting_id != meeting.id:
        fail(404, "PARTICIPANT_NOT_FOUND", "This participant does not belong to this meeting")
    if not matches_secret(token, participant.session_token_hash):
        fail(403, "PARTICIPANT_ACCESS_DENIED", "The participant token does not match")
    return participant


def record_connected(db: Session, meeting: Meeting, participant: Participant) -> Participant:
    require_live(meeting)
    if participant.left_at is not None:
        fail(409, "PARTICIPANT_LEFT", "Request a new join token to rejoin")
    if participant.joined_at is None:
        participant.joined_at = utc_now()
        db.commit()
    return participant


def record_leave(db: Session, participant: Participant) -> Participant:
    if participant.left_at is None:
        participant.left_at = utc_now()
        db.commit()
    return participant
