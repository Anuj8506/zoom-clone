"""The sole site administrator is configured by the server owner, not signup."""

from app.schemas.user import UserResponse


def is_admin(user, settings):
    return bool(user and user.password_hash and settings.admin_user_id == user.id
                and settings.admin_email and user.email == settings.admin_email.strip().lower())


def public_user(user, settings):
    return UserResponse.model_validate(user).model_copy(update={"is_admin": is_admin(user, settings)})
