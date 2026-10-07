from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils.time import UTCDateTime, utc_now

if TYPE_CHECKING:
    from app.models.meeting import Meeting
    from app.models.participant import Participant


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    display_name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)

    meetings: Mapped[list["Meeting"]] = relationship(back_populates="host")
    participants: Mapped[list["Participant"]] = relationship(back_populates="user")
