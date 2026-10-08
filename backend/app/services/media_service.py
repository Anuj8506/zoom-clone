"""LiveKit supplies media infrastructure; this server supplies access permissions."""

import json
import logging
import time
import asyncio
from datetime import timedelta
from uuid import uuid4

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

    async def participant_audio(self, room_name: str, identity: str, *, ask: bool = False) -> int:
        self.require_configuration()
        http_url = self.settings.livekit_url.replace("wss://", "https://", 1).replace("ws://", "http://", 1)
        try:
            async with api.LiveKitAPI(url=http_url, api_key=self.settings.livekit_api_key,
                                     api_secret=self.settings.livekit_api_secret.get_secret_value(), timeout=ClientTimeout(total=10)) as client:
                participant = await client.room.get_participant(api.RoomParticipantIdentity(room=room_name, identity=identity))
                if ask:
                    metadata = json.loads(participant.metadata or "{}")
                    if metadata.get("disconnect_reason"):
                        fail(409, "PARTICIPANT_LEFT", "This participant is leaving the meeting")
                    metadata["unmute_request"] = str(uuid4())
                    await client.room.update_participant(api.UpdateParticipantRequest(room=room_name, identity=identity, metadata=json.dumps(metadata)))
                    return 0  # Never enable a microphone remotely; only the guest may accept.
                count = 0
                for track in participant.tracks:
                    if track.source == api.TrackSource.MICROPHONE and not track.muted:
                        await client.room.mute_published_track(api.MuteRoomTrackRequest(room=room_name, identity=identity, track_sid=track.sid, muted=True))
                        count += 1
                return count
        except api.TwirpError as exc:
            if exc.code == "not_found":
                fail(404, "PARTICIPANT_NOT_CONNECTED", "This participant is no longer connected")
            fail(502, "HOST_CONTROL_FAILED", "Could not update the call. Please try again.")
        except (ClientError, TimeoutError):
            fail(502, "HOST_CONTROL_FAILED", "Could not update the call. Please try again.")

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
                can_publish=True, can_subscribe=True, can_publish_data=True, can_update_own_metadata=False,
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
                try:
                    active = await client.room.list_participants(api.ListParticipantsRequest(room=room_name))
                except api.TwirpError as exc:
                    if exc.code != "not_found":
                        raise
                    active = api.ListParticipantsResponse()
                for participant in active.participants:
                    try:
                        await client.room.update_participant(api.UpdateParticipantRequest(room=room_name, identity=participant.identity,
                            metadata=json.dumps({"role": json.loads(participant.metadata or "{}").get("role", "guest"), "disconnect_reason": "meeting-ended"})))
                    except api.TwirpError as exc:
                        if exc.code != "not_found":
                            raise
                if active.participants:
                    await asyncio.sleep(1)
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

    async def moderate(self, room_name: str, *, remove_identity: str | None = None, host_ids: list[str] = ()) -> int:
        self.require_configuration()
        http_url = self.settings.livekit_url.replace("wss://", "https://", 1).replace("ws://", "http://", 1)
        try:
            async with api.LiveKitAPI(url=http_url, api_key=self.settings.livekit_api_key,
                                     api_secret=self.settings.livekit_api_secret.get_secret_value(),
                                     timeout=ClientTimeout(total=10)) as client:
                if remove_identity:
                    await client.room.update_participant(api.UpdateParticipantRequest(room=room_name, identity=remove_identity,
                        metadata=json.dumps({"role": "guest", "disconnect_reason": "removed"})))
                    await asyncio.sleep(1)
                    await client.room.remove_participant(api.RoomParticipantIdentity(
                        room=room_name, identity=remove_identity, revoke_token_ts=int(time.time()) + 1))
                    return 1
                result = await client.room.list_participants(api.ListParticipantsRequest(room=room_name))
                count = 0
                for participant in result.participants:
                    if participant.identity in host_ids:
                        continue
                    for track in participant.tracks:
                        if track.source == api.TrackSource.MICROPHONE and not track.muted:
                            await client.room.mute_published_track(api.MuteRoomTrackRequest(
                                room=room_name, identity=participant.identity, track_sid=track.sid, muted=True))
                            count += 1
                return count
        except api.TwirpError as exc:
            if exc.code == "not_found":
                return 0
            fail(502, "HOST_CONTROL_FAILED", "Could not update the call. Please try again.")
        except (ClientError, TimeoutError):
            fail(502, "HOST_CONTROL_FAILED", "Could not update the call. Please try again.")
