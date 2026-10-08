from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_media
from app.models import Participant
from app.services import meeting_service, participant_service
from app.services.media_service import MediaService
from app.utils.errors import fail

router = APIRouter(prefix="/meetings", tags=["Host controls"])


@router.post("/{code}/mute-all")
async def mute_all(code: str, x_host_token: str | None = Header(default=None),
                   db: Session = Depends(get_db), media: MediaService = Depends(get_media)):
    meeting = meeting_service.get_meeting(db, code)
    meeting_service.require_host(meeting, x_host_token)
    meeting_service.require_live(meeting)
    host_ids = list(db.scalars(select(Participant.id).where(Participant.meeting_id == meeting.id, Participant.role == "host")))
    count = await media.moderate(meeting.room_name, host_ids=host_ids)
    return {"muted_count": count}


@router.post("/{code}/participants/{identity}/remove")
async def remove(code: str, identity: str, x_host_token: str | None = Header(default=None),
                 db: Session = Depends(get_db), media: MediaService = Depends(get_media)):
    meeting = meeting_service.get_meeting(db, code)
    meeting_service.require_host(meeting, x_host_token)
    meeting_service.require_live(meeting)
    participant = db.get(Participant, identity)
    if not participant or participant.meeting_id != meeting.id:
        fail(404, "PARTICIPANT_NOT_FOUND", "Participant not found in this meeting")
    if participant.role == "host":
        fail(409, "CANNOT_REMOVE_HOST", "Use End or Leave to disconnect the host")
    await media.moderate(meeting.room_name, remove_identity=identity)
    participant_service.record_leave(db, participant)
    return {"removed": True}
