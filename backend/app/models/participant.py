from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils.time import UTCDateTime

if TYPE_CHECKING:
    from app.models.meeting import Meeting
    from app.models.user import User


class Participant(Base):
    __tablename__ = "participants"
    __table_args__ = (CheckConstraint("role IN ('host', 'guest')"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    display_name: Mapped[str] = mapped_column(String(80))
    role: Mapped[str] = mapped_column(String(10))
    session_token_hash: Mapped[str] = mapped_column(String(64))
    joined_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    left_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    meeting: Mapped["Meeting"] = relationship(back_populates="participants")
    user: Mapped["User | None"] = relationship(back_populates="participants")
