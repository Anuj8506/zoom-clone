from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class JoinMeetingRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    display_name: str = Field(min_length=1, max_length=80)


class ParticipantSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    participant_id: UUID


class ParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    display_name: str
    role: Literal["host", "guest"]
    joined_at: datetime | None
    left_at: datetime | None


class JoinMeetingResponse(BaseModel):
    participant: ParticipantResponse
    participant_token: str
    livekit_url: str
    livekit_token: str
    room_name: str
