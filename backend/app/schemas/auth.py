import re
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def email_address(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value


class SignupRequest(LoginRequest):
    display_name: str = Field(min_length=1, max_length=80)

    @field_validator("display_name")
    @classmethod
    def name(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Enter your name")
        return value


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
