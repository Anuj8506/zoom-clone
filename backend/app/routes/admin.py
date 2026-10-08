"""Site-wide oversight; every endpoint requires the sole configured admin."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import get_db
from app.dependencies import require_admin, get_settings, get_media
from app.models import Meeting, User
from app.schemas.meeting import MeetingResponse
from app.schemas.user import UserResponse
from app.services import meeting_service
from app.services.admin_service import public_user
from app.services.media_service import MediaService

router = APIRouter(prefix="/admin", tags=["Site administrator"], dependencies=[Depends(require_admin)])


@router.get("/users", response_model=list[UserResponse])
def users(db: Session = Depends(get_db), settings: Settings = Depends(get_settings), offset: int = Query(0, ge=0)):
    return [public_user(user, settings) for user in db.scalars(select(User).order_by(User.id).offset(offset).limit(100))]


@router.get("/meetings", response_model=list[MeetingResponse])
def meetings(db: Session = Depends(get_db), settings: Settings = Depends(get_settings), offset: int = Query(0, ge=0)):
    return [meeting_service.public_meeting(meeting, settings) for meeting in db.scalars(
        select(Meeting).order_by(Meeting.created_at.desc(), Meeting.id).offset(offset).limit(100))]


@router.post("/meetings/{code}/end", response_model=MeetingResponse)
async def end(code: str, db: Session = Depends(get_db), settings: Settings = Depends(get_settings), media: MediaService = Depends(get_media)):
    meeting = meeting_service.get_meeting(db, code)
    participant_ids = meeting_service.end_authorized_meeting(db, meeting)
    await media.close_room(meeting.room_name, participant_ids)
    return meeting_service.public_meeting(meeting, settings)
