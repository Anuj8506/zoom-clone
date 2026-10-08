from datetime import timedelta
import asyncio
import sqlite3
from fastapi.testclient import TestClient
from app.main import create_app
from unittest.mock import AsyncMock, patch

import jwt
from livekit import api
from sqlalchemy import select
from app.models import User, Participant
from app.services.media_service import MediaService
from app.utils.time import utc_now


def register(client, email="bonus@example.com"):
    result = client.post("/auth/signup", json={"display_name": "Bonus User", "email": email, "password": "explainable-password"})
    assert result.status_code == 201
    return result.json()


def bearer(result):
    return {"Authorization": "Bearer " + result["access_token"]}


def test_account_column_migration_preserves_old_users(settings):
    path = settings.database_url.removeprefix("sqlite:///")
    with sqlite3.connect(path) as db:
        db.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, display_name VARCHAR(80) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE, created_at DATETIME NOT NULL)")
        db.execute("INSERT INTO users VALUES (2, 'Existing User', 'existing@example.com', '2026-10-08 00:00:00')")
    with TestClient(create_app(settings)) as client:
        with client.app.state.session_factory() as db:
            user = db.get(User, 2)
            assert user.display_name == "Existing User" and user.password_hash is None
        assert client.get("/users/me").json()["id"] == 1
        assert client.get("/health").status_code == 200


def test_signup_login_and_password_storage(client):
    result = register(client)
    assert "password_hash" not in result["user"]
    with client.app.state.session_factory() as db:
        saved = db.scalar(select(User).where(User.email == "bonus@example.com"))
        assert saved.password_hash and "explainable-password" not in saved.password_hash
    assert client.get("/users/me", headers=bearer(result)).json()["display_name"] == "Bonus User"
    assert client.get("/users/me").json()["id"] == 1
    duplicate = client.post("/auth/signup", json={"display_name": "Other", "email": " BONUS@example.com ", "password": "explainable-password"})
    assert duplicate.status_code == 409
    login = client.post("/auth/login", json={"email": "BONUS@example.com", "password": "explainable-password"})
    assert login.status_code == 200
    for email in ["bonus@example.com", "unknown@example.com"]:
        invalid = client.post("/auth/login", json={"email": email, "password": "wrong-password"})
        assert invalid.status_code == 401 and invalid.json()["detail"]["code"] == "INVALID_CREDENTIALS"
    assert client.post("/auth/signup", json={"display_name": "X", "email": "bad", "password": "short"}).status_code == 422


def test_account_ownership_host_recovery_and_invalid_sessions(client):
    first = register(client)
    other = register(client, "other@example.com")
    payload = {"title": "Private calendar", "scheduled_start_at": (utc_now() + timedelta(days=1)).isoformat(), "duration_minutes": 30}
    created = client.post("/meetings/scheduled", headers=bearer(first), json=payload).json()
    code = created["meeting"]["meeting_code"]
    assert len(client.get("/meetings/upcoming", headers=bearer(first)).json()) == 1
    assert client.get("/meetings/upcoming", headers=bearer(other)).json() == []
    assert code not in [m["meeting_code"] for m in client.get("/meetings/upcoming").json()]
    recovery = client.post(f"/meetings/{code}/host-access", headers=bearer(first))
    assert recovery.json()["host_token"] == created["host_token"]
    for headers in [{}, bearer(other)]:
        assert client.post(f"/meetings/{code}/host-access", headers=headers).status_code == 403
    assert client.post(f"/meetings/{code}/start", headers={"X-Host-Token": recovery.json()["host_token"]}).status_code == 200
    expired = jwt.encode({"sub": str(first["user"]["id"]), "iat": utc_now() - timedelta(hours=9), "exp": utc_now() - timedelta(hours=1), "iss": "zoom-clone", "aud": "zoom-clone-account"}, client.app.state.settings.auth_secret.get_secret_value(), algorithm="HS256")
    for token in [expired, "invalid"]:
        assert client.get("/users/me", headers={"Authorization": "Bearer " + token}).status_code == 401


def test_host_controls_authorization_and_attendance(media_client):
    client = media_client
    created = client.post("/meetings/instant", json={}).json()
    code = created["meeting"]["meeting_code"]
    headers = {"X-Host-Token": created["host_token"]}
    host = client.post(f"/meetings/{code}/join", headers=headers, json={"display_name": "Host"}).json()["participant"]
    guest = client.post(f"/meetings/{code}/join", json={"display_name": "Guest"}).json()["participant"]
    mock = client.app.state.media.moderate = AsyncMock(return_value=1)
    for extra, status in [({}, 401), ({"X-Host-Token": "wrong"}, 403)]:
        assert client.post(f"/meetings/{code}/mute-all", headers=extra).status_code == status
        assert client.post(f"/meetings/{code}/participants/{guest['id']}/remove", headers=extra).status_code == status
    mock.assert_not_awaited()
    assert client.post(f"/meetings/{code}/mute-all", headers=headers).json() == {"muted_count": 1}
    assert host["id"] in mock.call_args.kwargs["host_ids"]
    assert client.post(f"/meetings/{code}/participants/{host['id']}/remove", headers=headers).status_code == 409
    another = client.post("/meetings/instant", json={}).json()["meeting"]["meeting_code"]
    outsider = client.post(f"/meetings/{another}/join", json={"display_name": "Other"}).json()["participant"]
    assert client.post(f"/meetings/{code}/participants/{outsider['id']}/remove", headers=headers).status_code == 404
    assert client.post(f"/meetings/{code}/participants/{guest['id']}/remove", headers=headers).json() == {"removed": True}
    with client.app.state.session_factory() as db:
        assert db.get(Participant, guest["id"]).left_at is not None


def test_mute_all_only_mutes_guest_microphones(settings):
    from pydantic import SecretStr
    service = MediaService(settings.model_copy(update={"livekit_url": "wss://test.invalid", "livekit_api_key": "test-key", "livekit_api_secret": SecretStr("test-secret")}))
    room = AsyncMock()
    room.list_participants.return_value = api.ListParticipantsResponse(participants=[
        api.ParticipantInfo(identity="host", tracks=[api.TrackInfo(sid="host-mic", source=api.TrackSource.MICROPHONE)]),
        api.ParticipantInfo(identity="guest", tracks=[api.TrackInfo(sid="mic", source=api.TrackSource.MICROPHONE), api.TrackInfo(sid="screen-audio", source=api.TrackSource.SCREEN_SHARE_AUDIO), api.TrackInfo(sid="muted-mic", source=api.TrackSource.MICROPHONE, muted=True)]),
    ])
    connection = AsyncMock()
    connection.__aenter__.return_value.room = room
    with patch("app.services.media_service.api.LiveKitAPI", return_value=connection):
        assert asyncio.run(service.moderate("test-room", host_ids=["host"])) == 1
        room.mute_published_track.assert_awaited_once()
        assert room.mute_published_track.call_args.args[0].track_sid == "mic"


def test_individual_audio_controls_require_host_and_same_live_guest(media_client):
    client = media_client
    created = client.post("/meetings/instant", json={}).json()
    code = created["meeting"]["meeting_code"]
    headers = {"X-Host-Token": created["host_token"]}
    host = client.post(f"/meetings/{code}/join", headers=headers, json={"display_name": "Host"}).json()["participant"]
    guest = client.post(f"/meetings/{code}/join", json={"display_name": "Guest"}).json()
    other = client.post("/meetings/instant", json={}).json()["meeting"]["meeting_code"]
    outsider = client.post(f"/meetings/{other}/join", json={"display_name": "Other"}).json()["participant"]
    mock = client.app.state.media.participant_audio = AsyncMock(return_value=1)
    for action in ["mute", "ask-unmute"]:
        path = f"/meetings/{code}/participants/{guest['participant']['id']}/{action}"
        assert client.post(path).status_code == 401
        assert client.post(path, headers={"X-Host-Token": "wrong"}).status_code == 403
        assert client.post(f"/meetings/{code}/participants/{outsider['id']}/{action}", headers=headers).status_code == 404
        assert client.post(f"/meetings/{code}/participants/{host['id']}/{action}", headers=headers).status_code == 409
        assert client.post(path, headers=headers).status_code == 200
    assert mock.await_count == 2
    assert mock.await_args.kwargs == {"ask": True}
    client.post(f"/meetings/{code}/leave", headers={"X-Participant-Token": guest["participant_token"]}, json={"participant_id": guest["participant"]["id"]})
    assert client.post(path, headers=headers).status_code == 409
    client.post(f"/meetings/{code}/end", headers=headers)
    assert client.post(path, headers=headers).status_code == 410
    assert mock.await_count == 2


def test_individual_audio_mutes_only_microphone_and_request_never_unmutes(settings):
    import json
    from pydantic import SecretStr
    service = MediaService(settings.model_copy(update={"livekit_url": "wss://test.invalid", "livekit_api_key": "test-key", "livekit_api_secret": SecretStr("test-secret")}))
    room = AsyncMock()
    room.get_participant.return_value = api.ParticipantInfo(identity="guest", metadata='{"role":"guest","custom":"preserve"}', tracks=[
        api.TrackInfo(sid="mic", source=api.TrackSource.MICROPHONE), api.TrackInfo(sid="camera", source=api.TrackSource.CAMERA), api.TrackInfo(sid="screen-audio", source=api.TrackSource.SCREEN_SHARE_AUDIO)])
    context = AsyncMock()
    context.__aenter__.return_value.room = room
    with patch("app.services.media_service.api.LiveKitAPI", return_value=context):
        assert asyncio.run(service.participant_audio("room", "guest")) == 1
        request = room.mute_published_track.await_args.args[0]
        assert request.identity == "guest" and request.track_sid == "mic" and request.muted is True
        room.mute_published_track.reset_mock()
        asyncio.run(service.participant_audio("room", "guest", ask=True))
        room.mute_published_track.assert_not_awaited()
        metadata = json.loads(room.update_participant.await_args.args[0].metadata)
        assert metadata["role"] == "guest" and metadata["custom"] == "preserve"
        assert metadata["unmute_request"]
