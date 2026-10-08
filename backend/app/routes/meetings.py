from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import get_db
from app.dependencies import get_media, get_settings, get_current_user
from app.models import User
from app.schemas.meeting import (
    InstantMeetingCreate, MeetingCreatedResponse, MeetingLookup,
    MeetingResponse, ScheduledMeetingCreate,
)
from app.services import meeting_service
from app.services.media_service import MediaService
from app.utils.errors import fail

router = APIRouter(prefix="/meetings", tags=["Meetings"])


@router.post("/instant", response_model=MeetingCreatedResponse, status_code=201)
def create_instant(
    payload: InstantMeetingCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db), settings: Settings = Depends(get_settings),
):
    meeting, host_token = meeting_service.create_meeting(db, payload, "instant", user.id, settings)
    return {"meeting": meeting_service.public_meeting(meeting, settings), "host_token": host_token}


@router.post("/scheduled", response_model=MeetingCreatedResponse, status_code=201)
def create_scheduled(
    payload: ScheduledMeetingCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db), settings: Settings = Depends(get_settings),
):
    meeting, host_token = meeting_service.create_meeting(db, payload, "scheduled", user.id, settings)
    return {"meeting": meeting_service.public_meeting(meeting, settings), "host_token": host_token}


@router.get("/upcoming", response_model=list[MeetingResponse])
def list_upcoming(user: User = Depends(get_current_user), db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    return [meeting_service.public_meeting(item, settings) for item in meeting_service.upcoming_meetings(db, user.id)]


@router.get("/recent", response_model=list[MeetingResponse])
def list_recent(user: User = Depends(get_current_user), db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    return [meeting_service.public_meeting(item, settings) for item in meeting_service.recent_meetings(db, user.id)]


@router.post("/lookup", response_model=MeetingResponse)
def lookup(
    payload: MeetingLookup, db: Session = Depends(get_db), settings: Settings = Depends(get_settings),
):
    code = meeting_service.lookup_code(payload.meeting_input, settings)
    return meeting_service.public_meeting(meeting_service.get_meeting(db, code), settings)


@router.get("/{code}", response_model=MeetingResponse)
def read_meeting(code: str, db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    return meeting_service.public_meeting(meeting_service.get_meeting(db, code), settings)


@router.post("/{code}/start", response_model=MeetingResponse)
def start(
    code: str, x_host_token: str | None = Header(default=None),
    db: Session = Depends(get_db), settings: Settings = Depends(get_settings),
):
    meeting = meeting_service.get_meeting(db, code)
    meeting_service.start_meeting(db, meeting, x_host_token)
    return meeting_service.public_meeting(meeting, settings)


@router.post("/{code}/host-access")
def host_access(code: str, user: User = Depends(get_current_user), db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    meeting = meeting_service.get_meeting(db, code)
    if user.id == 1 or meeting.host_user_id != user.id:
        fail(403, "HOST_ACCESS_DENIED", "Sign in to the account that created this meeting")
    token = meeting_service.account_host_token(meeting.meeting_code, user.id, settings)
    meeting_service.require_host(meeting, token)
    return {"host_token": token}


@router.post("/{code}/end", response_model=MeetingResponse)
async def end(
    code: str, x_host_token: str | None = Header(default=None), db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings), media: MediaService = Depends(get_media),
):
    meeting = meeting_service.get_meeting(db, code)
    participant_ids = meeting_service.mark_ended(db, meeting, x_host_token)
    # Repeated End retries cleanup, without changing the original end timestamp.
    await media.close_room(meeting.room_name, participant_ids)
    return meeting_service.public_meeting(meeting, settings)
