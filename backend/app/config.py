"""Read configuration from environment variables and backend/.env."""

from pathlib import Path
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "Zoom Clone API"
    frontend_url: str = "http://localhost:3000"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    database_url: str = "sqlite:///./data/zoom_clone.db"
    seed_database: bool = True
    demo_user_name: str = Field(default="Demo User", min_length=1, max_length=80)
    auth_secret: SecretStr = SecretStr("")
    # Only this locally configured account can administer the site.
    admin_user_id: int | None = Field(default=None, ge=2)
    admin_email: str = ""
    admin_display_name: str = Field(default="Administrator", min_length=1, max_length=80)
    # Optional hosting-only bootstrap value; never a plaintext password.
    admin_password_hash: SecretStr = SecretStr("")
    livekit_url: str = ""
    livekit_api_key: str = Field(default="", repr=False)
    livekit_api_secret: SecretStr = SecretStr("")
    livekit_token_ttl_seconds: int = Field(default=300, ge=60, le=600)

    @field_validator("frontend_url")
    @classmethod
    def validate_frontend_origin(cls, value: str) -> str:
        value = value.strip().rstrip("/")
        parsed = urlsplit(value)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or parsed.path
            or parsed.query
            or parsed.fragment
            or parsed.username
        ):
            raise ValueError("FRONTEND_URL must be an http/https origin without a path")
        return value

    @field_validator("livekit_url")
    @classmethod
    def validate_livekit_url(cls, value: str) -> str:
        value = value.strip().rstrip("/")
        if value:
            parsed = urlsplit(value)
            if parsed.scheme not in {"ws", "wss"} or not parsed.netloc:
                raise ValueError("LIVEKIT_URL must start with ws:// or wss://")
        return value

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def media_configured(self) -> bool:
        return bool(self.livekit_url and self.livekit_api_key and self.livekit_api_secret.get_secret_value())
