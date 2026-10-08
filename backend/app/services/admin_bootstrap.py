"""Restore the configured sole administrator on an empty demo database."""

import re

from sqlalchemy import select

from app.models import User


def ensure_admin_account(db, settings):
    stored_hash = settings.admin_password_hash.get_secret_value()
    if not stored_hash:
        return
    if (not settings.admin_user_id or not settings.admin_email
            or not re.fullmatch(r"[0-9a-f]{32}:[0-9a-f]{128}", stored_hash)):
        raise ValueError("Admin bootstrap requires ID, email and a valid scrypt password hash")
    email = settings.admin_email.strip().lower()
    by_id = db.get(User, settings.admin_user_id)
    by_email = db.scalar(select(User).where(User.email == email))
    if by_id or by_email:
        if not by_id or by_id.email != email or not by_id.password_hash:
            raise ValueError("Admin bootstrap conflicts with an existing account")
        # Restarts must never overwrite a password changed in the database.
        return
    db.add(User(id=settings.admin_user_id, email=email,
                display_name=settings.admin_display_name, password_hash=stored_hash))
    db.commit()
