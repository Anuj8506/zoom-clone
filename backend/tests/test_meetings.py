from datetime import timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.utils.time import utc_now


def future_payload(**updates):
    payload = {
        "title": "Planning Session", "description": "Plan next steps",
        "scheduled_start_at": (utc_now() + timedelta(days=1)).isoformat(),
        "duration_minutes": 30,
    }
    payload.update(updates)
    return payload


def test_health_seed_and_restart_persistence(client, settings):
    assert client.get("/health").json() == {"status": "ok", "database": "connected", "media_configured": False}
    assert client.get("/users/me").json()["id"] == 1
    assert len(client.get("/meetings/upcoming").json()) == 2
    assert len(client.get("/meetings/recent").json()) == 2
    created = client.post("/meetings/scheduled", json=future_payload()).json()
    # A separate engine/lifespan represents restarting the backend on the same file.
    with TestClient(create_app(settings)) as restarted:
        assert len(restarted.get("/meetings/upcoming").json()) == 3
        assert len(restarted.get("/meetings/recent").json()) == 2
        assert restarted.get(f"/meetings/{created['meeting']['meeting_code']}").json()["title"] == "Planning Session"


def test_instant_unique_id_invite_and_public_secrets(client):
    first = client.post("/meetings/instant", json={"title": "  Standup  "})
    second = client.post("/meetings/instant", json={})
    assert first.status_code == second.status_code == 201
    data = first.json()
    meeting = data["meeting"]
    assert meeting["title"] == "Standup"
    assert meeting["status"] == "live" and meeting["started_at"] is not None
    assert len(meeting["meeting_code"]) == 11 and meeting["meeting_code"].isdigit()
    assert meeting["meeting_code"] != second.json()["meeting"]["meeting_code"]
    assert data["host_token"] != second.json()["host_token"]
    assert meeting["invite_link"].endswith(f"/join/{meeting['meeting_code']}")
    for public in [client.get(f"/meetings/{meeting['meeting_code']}").json(), meeting]:
        assert "host_token" not in public and "host_capability_hash" not in public


def test_database_collision_retries(client):
    with patch("app.services.meeting_service.generate_meeting_code", side_effect=["92000000001", "92000000001", "92000000002"]):
        assert client.post("/meetings/instant", json={}).status_code == 201
        second = client.post("/meetings/instant", json={})
    assert second.status_code == 201
    assert second.json()["meeting"]["meeting_code"] == "92000000002"


def test_lookup_id_invite_and_invalid_input(client):
    created = client.post("/meetings/instant", json={}).json()["meeting"]
    code = created["meeting_code"]
    formatted = f"{code[:3]}-{code[3:7]} {code[7:]}"
    for value in [formatted, created["invite_link"]]:
        response = client.post("/meetings/lookup", json={"meeting_input": value})
        assert response.status_code == 200 and response.json()["meeting_code"] == code
    for value in ["abc", f"https://foreign.example/join/{code}", "http://[broken/join/123"]:
        assert client.post("/meetings/lookup", json={"meeting_input": value}).status_code == 422
    assert client.get("/meetings/99999999999").status_code == 404


@pytest.mark.parametrize("updates", [
    {"title": "   "}, {"duration_minutes": 0}, {"duration_minutes": "30"},
    {"scheduled_start_at": (utc_now() - timedelta(hours=1)).isoformat()},
    {"scheduled_start_at": (utc_now() + timedelta(days=1)).replace(tzinfo=None).isoformat()},
    {"scheduled_start_at": 9999999999},
])
def test_schedule_rejects_invalid_requests(client, updates):
    assert client.post("/meetings/scheduled", json=future_payload(**updates)).status_code == 422


def test_schedule_normalizes_offset_to_utc(client):
    value = (utc_now() + timedelta(days=2)).replace(microsecond=0)
    from datetime import timezone
    offset = timezone(timedelta(hours=5, minutes=30))
    response = client.post("/meetings/scheduled", json=future_payload(scheduled_start_at=value.astimezone(offset).isoformat()))
    assert response.status_code == 201
    saved = response.json()["meeting"]
    assert saved["scheduled_start_at"] == value.isoformat().replace("+00:00", "Z")
    assert saved["meeting_code"] in [item["meeting_code"] for item in client.get("/meetings/upcoming").json()]


def test_waiting_host_permissions_and_ended_state(client):
    created = client.post("/meetings/scheduled", json=future_payload()).json()
    code, token = created["meeting"]["meeting_code"], created["host_token"]
    join = client.post(f"/meetings/{code}/join", json={"display_name": "Guest"})
    assert join.status_code == 409 and join.json()["detail"]["code"] == "WAITING_FOR_HOST"
    assert client.post(f"/meetings/{code}/start").status_code == 401
    assert client.post(f"/meetings/{code}/start", headers={"X-Host-Token": "wrong"}).status_code == 403
    started = client.post(f"/meetings/{code}/start", headers={"X-Host-Token": token})
    assert started.status_code == 200 and started.json()["status"] == "live"
    again = client.post(f"/meetings/{code}/start", headers={"X-Host-Token": token})
    assert again.json()["started_at"] == started.json()["started_at"]
    unconfigured = client.post(f"/meetings/{code}/join", json={"display_name": "Guest"})
    assert unconfigured.status_code == 503 and unconfigured.json()["detail"]["code"] == "MEDIA_NOT_CONFIGURED"
    assert client.post(f"/meetings/{code}/end", headers={"X-Host-Token": "wrong"}).status_code == 403
    ended = client.post(f"/meetings/{code}/end", headers={"X-Host-Token": token})
    assert ended.status_code == 200 and ended.json()["status"] == "ended"
    assert client.post(f"/meetings/{code}/end", headers={"X-Host-Token": token}).json()["ended_at"] == ended.json()["ended_at"]
    assert client.post(f"/meetings/{code}/join", json={"display_name": "Guest"}).status_code == 410
    assert client.post(f"/meetings/{code}/start", headers={"X-Host-Token": token}).status_code == 409
    assert code in [item["meeting_code"] for item in client.get("/meetings/recent").json()]


def test_cors_allows_frontend_and_rejects_unknown_origins(client):
    headers = {"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "X-Host-Token,Content-Type"}
    assert client.options("/meetings/instant", headers=headers).status_code == 200
    headers["Origin"] = "https://foreign.example"
    assert client.options("/meetings/instant", headers=headers).status_code == 400
