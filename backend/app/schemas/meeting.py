from datetime import datetime, timezone
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator

from app.utils.time import utc_now


class InstantMeetingCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    title: str = Field(default="New Meeting", min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)


class ScheduledMeetingCreate(InstantMeetingCreate):
    title: str = Field(min_length=1, max_length=120)
    scheduled_start_at: AwareDatetime
    duration_minutes: int = Field(ge=1, le=1440, strict=True)

    @field_validator("scheduled_start_at", mode="before")
    @classmethod
    def require_iso_string(cls, value):
        if not isinstance(value, str):
            raise ValueError("Send scheduled_start_at as an ISO timestamp string with a timezone")
        return value

    @field_validator("scheduled_start_at")
    @classmethod
    def require_future_start(cls, value: datetime) -> datetime:
        value = value.astimezone(timezone.utc)
        if value <= utc_now():
            raise ValueError("Schedule the meeting in the future")
        return value


class MeetingLookup(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    meeting_input: str = Field(min_length=1, max_length=1000)


class MeetingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    meeting_code: str
    host_user_id: int
    title: str
    description: str
    kind: Literal["instant", "scheduled"]
    status: Literal["scheduled", "live", "ended"]
    scheduled_start_at: datetime | None
    duration_minutes: int | None
    started_at: datetime | None
    ended_at: datetime | None
    created_at: datetime
    room_name: str
    invite_link: str = ""


class MeetingCreatedResponse(BaseModel):
    meeting: MeetingResponse
    host_token: str
