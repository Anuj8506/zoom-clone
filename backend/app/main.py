"""Compose the application; feature logic lives in routes and services."""

from contextlib import asynccontextmanager
import secrets
from pydantic import SecretStr
from sqlalchemy import inspect, text

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import sessionmaker

from app.config import Settings
from app.database import Base, build_engine
from app.routes import health, meetings, participants, users, auth, moderation
from app.seed_data import ensure_demo_user, seed_database
from app.services.media_service import MediaService


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    if not settings.auth_secret.get_secret_value():
        settings = settings.model_copy(update={"auth_secret": SecretStr(secrets.token_urlsafe(48))})

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = build_engine(settings)
        factory = sessionmaker(bind=engine, expire_on_commit=False)
        app.state.engine = engine
        app.state.session_factory = factory
        try:
            Base.metadata.create_all(engine)
            # One additive migration preserves existing demo data from before accounts.
            if "password_hash" not in {column["name"] for column in inspect(engine).get_columns("users")}:
                with engine.begin() as connection:
                    connection.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)"))
            with factory() as db:
                if settings.seed_database:
                    seed_database(db, settings)
                else:
                    ensure_demo_user(db, settings)
            yield
        finally:
            engine.dispose()

    app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.media = MediaService(settings)
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.allowed_origins,
        allow_credentials=False, allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-Host-Token", "X-Participant-Token", "Authorization"],
    )
    app.include_router(health.router)
    app.include_router(users.router)
    app.include_router(auth.router)
    app.include_router(moderation.router)
    app.include_router(meetings.router)
    app.include_router(participants.router)
    return app


app = create_app()
