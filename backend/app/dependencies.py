from fastapi import Request

from app.config import Settings
from app.services.media_service import MediaService


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_media(request: Request) -> MediaService:
    return request.app.state.media
