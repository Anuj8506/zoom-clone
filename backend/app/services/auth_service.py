import hashlib
import hmac
import secrets
from datetime import timedelta

import jwt
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.models import User
from app.utils.errors import fail
from app.utils.time import utc_now


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384,
                            r=8, p=1, maxmem=64 * 1024 * 1024).hex()
    return f"{salt}:{digest}"


def issue_session(user, settings):
    now = utc_now()
    token = jwt.encode({"sub": str(user.id), "iat": now, "exp": now + timedelta(hours=8),
                        "iss": "zoom-clone", "aud": "zoom-clone-account"},
                       settings.auth_secret.get_secret_value(), algorithm="HS256")
    return {"access_token": token, "user": user}


def signup(db, payload, settings):
    user = User(display_name=payload.display_name, email=payload.email,
                password_hash=password_hash(payload.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        fail(409, "EMAIL_EXISTS", "An account with this email already exists")
    return issue_session(user, settings)


def login(db, payload, settings):
    user = db.scalar(select(User).where(User.email == payload.email))
    # Also perform a password derivation for unknown accounts to avoid a cheap
    # email-enumeration timing difference. Never compare plaintext passwords.
    stored = user.password_hash if user and user.password_hash else "00" * 16 + ":" + "00" * 64
    valid = hmac.compare_digest(password_hash(payload.password, stored.split(":")[0]), stored)
    if not user or not user.password_hash or not valid:
        fail(401, "INVALID_CREDENTIALS", "Email or password is incorrect")
    return issue_session(user, settings)
