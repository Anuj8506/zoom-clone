from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils.time import UTCDateTime, utc_now

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.participant import Participant


class Meeting(Base):
    __tablename__ = "meetings"
    __table_args__ = (
        CheckConstraint("kind IN ('instant', 'scheduled')"),
        CheckConstraint("status IN ('scheduled', 'live', 'ended')"),
        CheckConstraint("duration_minutes IS NULL OR duration_minutes > 0"),
        CheckConstraint("kind != 'scheduled' OR (scheduled_start_at IS NOT NULL AND duration_minutes IS NOT NULL)"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    meeting_code: Mapped[str] = mapped_column(String(11), unique=True, index=True)
    host_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    host_capability_hash: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    kind: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), index=True)
    scheduled_start_at: Mapped[datetime | None] = mapped_column(UTCDateTime, index=True)
    duration_minutes: Mapped[int | None]
    started_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    ended_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)

    host: Mapped["User"] = relationship(back_populates="meetings")
    participants: Mapped[list["Participant"]] = relationship(back_populates="meeting")

    @property
    def room_name(self) -> str:
        return f"meeting-{self.id}"
