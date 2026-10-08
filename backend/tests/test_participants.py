from unittest.mock import AsyncMock, patch

import jwt
from fastapi import HTTPException
from livekit import api


def instant(client):
    response = client.post("/meetings/instant", json={})
    assert response.status_code == 201
    return response.json()


def join(client, code, headers=None):
    response = client.post(f"/meetings/{code}/join", json={"display_name": "  Alex  "}, headers=headers)
    assert response.status_code == 200
    return response.json()


def test_signed_media_tokens_roles_and_secret_boundaries(media_client):
    created = instant(media_client)
    code, host_token = created["meeting"]["meeting_code"], created["host_token"]
    guest = join(media_client, code)
    host = join(media_client, code, {"X-Host-Token": host_token})
    secret = media_client.app.state.settings.livekit_api_secret.get_secret_value()
    claims = jwt.decode(guest["livekit_token"], secret, algorithms=["HS256"])
    assert claims["sub"] == guest["participant"]["id"]
    assert claims["video"]["room"] == created["meeting"]["room_name"]
    assert claims["video"]["roomJoin"] is True and claims["video"]["roomAdmin"] is False
    assert claims["video"]["canUpdateOwnMetadata"] is False
    assert claims["exp"] - claims["nbf"] == 300
    assert guest["participant"]["role"] == "guest" and host["participant"]["role"] == "host"
    assert guest["participant"]["display_name"] == "Alex"
    assert guest["participant"]["joined_at"] is None
    assert guest["participant"]["id"] != host["participant"]["id"]
    assert "session_token_hash" not in guest["participant"]
    assert media_client.post(f"/meetings/{code}/join", json={"display_name": "Guest", "role": "host"}).status_code == 422
    assert media_client.post(f"/meetings/{code}/join", json={"display_name": " "}).status_code == 422
    assert media_client.post(f"/meetings/{code}/join", json={"display_name": "Guest"}, headers={"X-Host-Token": "wrong"}).status_code == 403


def test_attendance_authorization_retries_and_out_of_order_events(media_client):
    code = instant(media_client)["meeting"]["meeting_code"]
    joined = join(media_client, code)
    payload = {"participant_id": joined["participant"]["id"]}
    headers = {"X-Participant-Token": joined["participant_token"]}
    assert media_client.post(f"/meetings/{code}/connected", json=payload).status_code == 401
    assert media_client.post(f"/meetings/{code}/connected", json=payload, headers={"X-Participant-Token": "wrong"}).status_code == 403
    connected = media_client.post(f"/meetings/{code}/connected", json=payload, headers=headers)
    assert connected.status_code == 200 and connected.json()["joined_at"] is not None
    again = media_client.post(f"/meetings/{code}/connected", json=payload, headers=headers)
    assert again.json()["joined_at"] == connected.json()["joined_at"]
    left = media_client.post(f"/meetings/{code}/leave", json=payload, headers=headers)
    assert left.status_code == 200 and left.json()["left_at"] is not None
    assert media_client.post(f"/meetings/{code}/leave", json=payload, headers=headers).json()["left_at"] == left.json()["left_at"]
    assert media_client.post(f"/meetings/{code}/connected", json=payload, headers=headers).status_code == 409
    other_code = instant(media_client)["meeting"]["meeting_code"]
    assert media_client.post(f"/meetings/{other_code}/leave", json=payload, headers=headers).status_code == 404


def test_end_blocks_joins_even_when_remote_cleanup_needs_retry(media_client):
    created = instant(media_client)
    code = created["meeting"]["meeting_code"]
    headers = {"X-Host-Token": created["host_token"]}
    close = media_client.app.state.media.close_room
    close.side_effect = HTTPException(502, detail={"code": "MEDIA_CLEANUP_FAILED", "message": "Retry End"})
    assert media_client.post(f"/meetings/{code}/end", headers=headers).status_code == 502
    assert media_client.get(f"/meetings/{code}").json()["status"] == "ended"
    assert media_client.post(f"/meetings/{code}/join", json={"display_name": "Guest"}).status_code == 410
    close.side_effect = None
    assert media_client.post(f"/meetings/{code}/end", headers=headers).status_code == 200
    assert close.await_count == 2


def test_late_connected_report_after_end_is_safe_and_does_not_reopen_attendance(media_client):
    created = instant(media_client)
    code = created["meeting"]["meeting_code"]
    participant = join(media_client, code)
    payload = {"participant_id": participant["participant"]["id"]}
    headers = {"X-Participant-Token": participant["participant_token"]}
    assert media_client.post(f"/meetings/{code}/end", headers={"X-Host-Token": created["host_token"]}).status_code == 200
    assert media_client.post(f"/meetings/{code}/connected", json=payload).status_code == 401
    report = media_client.post(f"/meetings/{code}/connected", headers=headers, json=payload)
    assert report.status_code == 200
    assert report.json()["joined_at"] is None
    assert report.json()["left_at"] == media_client.get(f"/meetings/{code}").json()["ended_at"]
    assert media_client.post(f"/meetings/{code}/connected", headers=headers, json=payload).json() == report.json()
    assert media_client.post(f"/meetings/{code}/join", json={"display_name": "New guest"}).status_code == 410


def test_livekit_room_cleanup_revokes_tokens_and_handles_absent_room(media_client):
    service = media_client.app.state.media
    # Use the original method because the fixture stubs it for HTTP workflow tests.
    from app.services.media_service import MediaService
    import asyncio
    room = AsyncMock()
    room.list_participants.return_value = api.ListParticipantsResponse()
    room.remove_participant.side_effect = api.TwirpError("not_found", "absent", status=404)
    room.delete_room.side_effect = api.TwirpError("not_found", "absent", status=404)
    fake_api = AsyncMock()
    fake_api.room = room
    context = AsyncMock()
    context.__aenter__.return_value = fake_api
    with patch("app.services.media_service.api.LiveKitAPI", return_value=context):
        asyncio.run(MediaService.close_room(service, "test-room", ["participant-1"]))
    removal = room.remove_participant.await_args.args[0]
    assert removal.identity == "participant-1" and removal.revoke_token_ts > 0
    assert room.delete_room.await_args.args[0].room == "test-room"
