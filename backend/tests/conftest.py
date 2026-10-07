from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def settings(tmp_path):
    return Settings(
        _env_file=None,
        database_url=f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        frontend_url="http://localhost:3000", seed_database=True,
        livekit_url="", livekit_api_key="", livekit_api_secret="",
    )


@pytest.fixture
def app(settings):
    return create_app(settings)


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def media_client(settings):
    # Real JWT signing with test-only keys; remote room cleanup is stubbed.
    media_settings = settings.model_copy(update={
        "livekit_url": "wss://test.invalid",
        "livekit_api_key": "test-key",
        "livekit_api_secret": settings.livekit_api_secret.__class__("test-only-secret-that-is-at-least-32-characters"),
    })
    application = create_app(media_settings)
    application.state.media.close_room = AsyncMock()
    with TestClient(application) as test_client:
        yield test_client
