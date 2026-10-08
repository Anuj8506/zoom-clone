import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import select

from app.main import create_app
from app.models import User
from app.services.admin_bootstrap import ensure_admin_account
from app.services.auth_service import password_hash


def hosted_settings(settings):
    return settings.model_copy(update={
        "admin_user_id": 2, "admin_email": "owner@example.com",
        "admin_password_hash": SecretStr(password_hash("test-password-123")),
    })


def test_fresh_host_restores_only_admin(settings):
    application = create_app(hosted_settings(settings))
    with TestClient(application) as client:
        response = client.post("/auth/login", json={
            "email": "owner@example.com", "password": "test-password-123",
        })
        assert response.status_code == 200
        assert response.json()["user"]["is_admin"] is True
        with application.state.session_factory() as db:
            assert len(db.scalars(select(User)).all()) == 2


def test_restart_preserves_changed_admin_password(settings):
    configured = hosted_settings(settings)
    application = create_app(configured)
    with TestClient(application):
        with application.state.session_factory() as db:
            changed = password_hash("changed-password-123")
            db.get(User, 2).password_hash = changed
            db.commit()
            ensure_admin_account(db, configured)
            assert db.get(User, 2).password_hash == changed


def test_collision_does_not_promote_another_account(settings):
    application = create_app(settings)
    with TestClient(application):
        with application.state.session_factory() as db:
            db.add(User(id=2, email="someone@example.com", display_name="Member",
                        password_hash=password_hash("member-password")))
            db.commit()
            with pytest.raises(ValueError, match="conflicts"):
                ensure_admin_account(db, hosted_settings(settings))
            assert db.get(User, 2).email == "someone@example.com"


def test_invalid_bootstrap_hash_fails_without_account(settings):
    application = create_app(settings)
    with TestClient(application):
        with application.state.session_factory() as db:
            configured = hosted_settings(settings).model_copy(update={
                "admin_password_hash": SecretStr("invalid"),
            })
            with pytest.raises(ValueError, match="valid scrypt"):
                ensure_admin_account(db, configured)
            assert db.get(User, 2) is None
