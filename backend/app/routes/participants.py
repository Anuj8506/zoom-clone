from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import get_db
from app.dependencies import get_media, get_settings
from app.schemas.participant import (
    JoinMeetingRequest, JoinMeetingResponse, ParticipantResponse, ParticipantSessionRequest,
)
from app.services import meeting_service, participant_service
from app.services.media_service import MediaService

router = APIRouter(prefix="/meetings", tags=["Participants"])


@router.post("/{code}/join", response_model=JoinMeetingResponse)
def join(
    code: str, payload: JoinMeetingRequest, x_host_token: str | None = Header(default=None),
    db: Session = Depends(get_db), settings: Settings = Depends(get_settings),
    media: MediaService = Depends(get_media),
):
    meeting = meeting_service.get_meeting(db, code)
    participant, participant_token, livekit_token = participant_service.join_meeting(db, meeting, payload, media, x_host_token)
    return {
        "participant": participant, "participant_token": participant_token,
        "livekit_url": settings.livekit_url, "livekit_token": livekit_token,
        "room_name": meeting.room_name,
    }


@router.post("/{code}/connected", response_model=ParticipantResponse)
def connected(
    code: str, payload: ParticipantSessionRequest, x_participant_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    meeting = meeting_service.get_meeting(db, code)
    participant = participant_service.authorized_participant(db, meeting, str(payload.participant_id), x_participant_token)
    return participant_service.record_connected(db, meeting, participant)


@router.post("/{code}/leave", response_model=ParticipantResponse)
def leave(
    code: str, payload: ParticipantSessionRequest, x_participant_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    meeting = meeting_service.get_meeting(db, code)
    participant = participant_service.authorized_participant(db, meeting, str(payload.participant_id), x_participant_token)
    return participant_service.record_leave(db, participant)
