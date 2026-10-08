from unittest.mock import AsyncMock
from fastapi.testclient import TestClient
from app.main import create_app


def signup(client, email="owner@example.com"):
    response = client.post("/auth/signup", json={"email": email, "display_name": "Owner", "password": "test-owner-password"})
    assert response.status_code == 201
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def test_only_configured_account_can_administer_site(settings):
    app = create_app(settings.model_copy(update={"admin_user_id": 2, "admin_email": "owner@example.com"}))
    app.state.media.close_room = AsyncMock()
    with TestClient(app) as client:
        owner = signup(client)
        member = signup(client, "member@example.com")
        assert client.get("/users/me", headers=owner).json()["is_admin"] is True
        assert client.get("/users/me", headers=member).json()["is_admin"] is False
        assert client.get("/users/me").json()["is_admin"] is False
        code = client.post("/meetings/instant", headers=member, json={}).json()["meeting"]["meeting_code"]
        for headers in [{}, member, {"Authorization": "Bearer invalid"}]:
            assert client.get("/admin/users", headers=headers).status_code in (401, 403)
            assert client.get("/admin/meetings", headers=headers).status_code in (401, 403)
            assert client.post(f"/admin/meetings/{code}/end", headers=headers).status_code in (401, 403)
        assert client.get(f"/meetings/{code}").json()["status"] == "live"
        users = client.get("/admin/users", headers=owner).json()
        assert sum(user["is_admin"] for user in users) == 1
        assert all("password_hash" not in user for user in users)
        assert code in [meeting["meeting_code"] for meeting in client.get("/admin/meetings", headers=owner).json()]
        assert client.get("/admin/meetings?offset=100", headers=owner).json() == []
        assert client.post("/auth/signup", json={"email": "fake@example.com", "display_name": "Fake", "password": "test-fake-password", "is_admin": True}).status_code == 422
        assert client.post(f"/admin/meetings/{code}/end", headers=owner).json()["status"] == "ended"
        assert client.post(f"/admin/meetings/{code}/end", headers=owner).status_code == 200
        assert app.state.media.close_room.await_count == 2


def test_email_alone_or_id_alone_cannot_grant_admin(settings):
    for index, (admin_id, email) in enumerate([(2, "another@example.com"), (3, "owner@example.com"), (None, "owner@example.com")]):
        with TestClient(create_app(settings.model_copy(update={"admin_user_id": admin_id, "admin_email": email, "database_url": settings.database_url.replace('test.db', f'admin-{index}.db')}))) as client:
            headers = signup(client)
            assert client.get("/users/me", headers=headers).json()["is_admin"] is False
            assert client.get("/admin/users", headers=headers).status_code == 403
