"""Stable sample identifiers make startup seeding repeatable."""

from datetime import timedelta
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Meeting, Participant, User
from app.utils.security import hash_secret
from app.utils.time import utc_now

# This is intentionally public and applies only to seeded demonstration records.
# Real meeting creation always generates a random, private host capability.
DEMO_HOST_TOKEN = "demo-meetings-host-token"
SEED_MEETING_CODES = ("91000000001", "91000000002", "91000000003", "91000000004")


def ensure_demo_user(db: Session, settings: Settings) -> None:
    if db.get(User, 1) is None:
        db.add(User(id=1, display_name=settings.demo_user_name, email="demo@example.com"))
        db.commit()


def seed_database(db: Session, settings: Settings) -> None:
    ensure_demo_user(db, settings)
    now = utc_now()
    samples = [
        ("Team Standup", "Quick updates and today's priorities.", now + timedelta(hours=2), 30, False),
        ("Project Planning", "Discuss the next set of tasks.", now + timedelta(days=1), 60, False),
        ("Design Review", "Review the dashboard and meeting flow.", now - timedelta(hours=4), 45, True),
        ("Weekly Check-in", "Share progress and questions.", now - timedelta(days=1), 30, True),
    ]
    for code, (title, description, start, duration, ended) in zip(SEED_MEETING_CODES, samples):
        if db.scalar(select(Meeting.id).where(Meeting.meeting_code == code)) is not None:
            continue
        meeting = Meeting(
            id=str(uuid5(NAMESPACE_URL, f"zoom-clone-demo:{code}")),
            meeting_code=code, host_user_id=1, host_capability_hash=hash_secret(DEMO_HOST_TOKEN),
            title=title, description=description, kind="scheduled",
            status="ended" if ended else "scheduled", scheduled_start_at=start,
            duration_minutes=duration, created_at=now - timedelta(days=2),
            started_at=start if ended else None,
            ended_at=start + timedelta(minutes=duration) if ended else None,
        )
        db.add(meeting)
        db.flush()
        if ended:
            db.add(Participant(
                id=str(uuid5(NAMESPACE_URL, f"zoom-clone-demo-attendee:{code}")),
                meeting_id=meeting.id, user_id=1, display_name=settings.demo_user_name,
                role="host", session_token_hash=hash_secret(f"unusable-demo-attendee:{code}"),
                joined_at=meeting.started_at, left_at=meeting.ended_at,
            ))
    db.commit()
