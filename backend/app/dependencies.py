from fastapi import Request, Header, Depends
from sqlalchemy.orm import Session
import jwt
from app.database import get_db
from app.models import User
from app.utils.errors import fail

from app.config import Settings
from app.services.media_service import MediaService
from app.services.admin_service import is_admin


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_media(request: Request) -> MediaService:
    return request.app.state.media


def get_current_user(request: Request, authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    if authorization is None:
        return db.get(User, 1)
    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise ValueError()
        claims = jwt.decode(token, request.app.state.settings.auth_secret.get_secret_value(),
                            algorithms=["HS256"], issuer="zoom-clone", audience="zoom-clone-account",
                            options={"require": ["exp", "sub", "iat"]})
        user = db.get(User, int(claims["sub"]))
        if user is None:
            raise ValueError()
        return user
    except (jwt.InvalidTokenError, ValueError, TypeError):
        fail(401, "SESSION_EXPIRED", "Your session expired. Sign in again or continue as the demo user.")


def require_admin(user: User = Depends(get_current_user), settings: Settings = Depends(get_settings)) -> User:
    if not is_admin(user, settings):
        fail(403, "ADMIN_ACCESS_DENIED", "Only the site administrator can access this page")
    return user
