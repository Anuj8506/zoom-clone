"""Provision the sole owner locally. Never expose this as a public API."""

import argparse
import getpass
import os
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import BACKEND_DIR, Settings
from app.database import build_engine
from app.models import User
from app.schemas.auth import SignupRequest
from app.services.auth_service import password_hash


def main():
    parser = argparse.ArgumentParser(description="Create/update the sole site administrator")
    parser.add_argument("email")
    parser.add_argument("--name", default="Site Owner")
    args = parser.parse_args()
    # An environment value is useful for controlled local provisioning, never saved.
    password = os.environ.pop("ZOOM_ADMIN_PASSWORD", None) or getpass.getpass("Admin password: ")
    payload = SignupRequest(email=args.email, display_name=args.name, password=password)
    engine = build_engine(Settings())
    try:
        with Session(engine) as db:
            user = db.scalar(select(User).where(User.email == payload.email))
            if user and user.id == 1:
                raise ValueError("The shared demo account cannot be administrator")
            if user is None:
                user = User(email=payload.email, display_name=payload.display_name)
                db.add(user)
            user.password_hash = password_hash(payload.password)
            db.commit()
            admin_id = user.id
    finally:
        engine.dispose()
    env_path = BACKEND_DIR / ".env"
    lines = env_path.read_text(encoding="utf-8").splitlines() if env_path.exists() else []
    lines = [line for line in lines if not line.strip().startswith(("ADMIN_USER_ID=", "ADMIN_EMAIL="))]
    lines.extend([f"ADMIN_USER_ID={admin_id}", f"ADMIN_EMAIL={payload.email}"])
    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Sole administrator configured (account #{admin_id}). Restart the backend.")


if __name__ == "__main__":
    main()
