"""Database construction and one session per request."""

from collections.abc import Generator
from pathlib import Path

from fastapi import Request
from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session
from sqlalchemy.pool import StaticPool

from app.config import BACKEND_DIR, Settings


class Base(DeclarativeBase):
    pass


def build_engine(settings: Settings):
    url = make_url(settings.database_url)
    if url.drivername != "sqlite":
        raise ValueError("This assignment requires a sqlite:/// DATABASE_URL")
    options = {"connect_args": {"check_same_thread": False, "timeout": 10}}
    if url.database in {None, "", ":memory:"}:
        options["poolclass"] = StaticPool
    else:
        path = Path(url.database)
        if not path.is_absolute():
            path = BACKEND_DIR / path
        path = path.resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        url = url.set(database=str(path))
    engine = create_engine(url, **options)

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    return engine


def get_db(request: Request) -> Generator[Session, None, None]:
    with request.app.state.session_factory() as session:
        yield session
