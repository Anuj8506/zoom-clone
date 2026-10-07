"""LiveKit supplies media infrastructure; this server supplies access permissions."""

import json
import logging
import time
from datetime import timedelta

from aiohttp import ClientError, ClientTimeout
from livekit import api

from app.config import Settings
from app.models import Meeting, Participant
from app.utils.errors import fail

logger = logging.getLogger(__name__)


class MediaService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def require_configuration(self) -> None:
        if not self.settings.media_configured:
            fail(503, "MEDIA_NOT_CONFIGURED", "Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in backend/.env")

    def issue_token(self, meeting: Meeting, participant: Participant) -> str:
        self.require_configuration()
        return (
            api.AccessToken(self.settings.livekit_api_key, self.settings.livekit_api_secret.get_secret_value())
            .with_identity(participant.id)
            .with_name(participant.display_name)
            .with_metadata(json.dumps({"role": participant.role}))
            .with_ttl(timedelta(seconds=self.settings.livekit_token_ttl_seconds))
            .with_grants(api.VideoGrants(
                room_join=True, room=meeting.room_name, room_admin=False,
                can_publish=True, can_subscribe=True, can_publish_data=True,
            ))
            .to_jwt()
        )

    async def close_room(self, room_name: str, participant_ids: list[str]) -> None:
        if not self.settings.media_configured:
            return  # No media tokens can have been issued in unconfigured mode.
        http_url = self.settings.livekit_url.replace("wss://", "https://", 1).replace("ws://", "http://", 1)
        try:
            async with api.LiveKitAPI(
                url=http_url, api_key=self.settings.livekit_api_key,
                api_secret=self.settings.livekit_api_secret.get_secret_value(),
                timeout=ClientTimeout(total=10),
            ) as client:
                # LiveKit Cloud also revokes issued tokens, even for pending participants.
                cutoff = int(time.time()) + 1
                for identity in participant_ids:
                    try:
                        await client.room.remove_participant(api.RoomParticipantIdentity(
                            room=room_name, identity=identity, revoke_token_ts=cutoff,
                        ))
                    except api.TwirpError as exc:
                        if exc.code != "not_found":
                            raise
                try:
                    await client.room.delete_room(api.DeleteRoomRequest(room=room_name))
                except api.TwirpError as exc:
                    if exc.code != "not_found":
                        raise
        except (api.TwirpError, ClientError, TimeoutError) as exc:
            logger.warning("Media cleanup failed for %s (%s)", room_name, type(exc).__name__)
            fail(502, "MEDIA_CLEANUP_FAILED", "Meeting is marked ended, but media cleanup failed. Retry End Meeting with the same host token.")
