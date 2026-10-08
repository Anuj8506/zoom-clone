"use client";
import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";

// Only the backend can update metadata on these room grants. Guests cannot
// manufacture a host End/Remove command through a chat/data message.
export default function MeetingControlListener({ onExit }) {
  const room = useRoomContext();
  useEffect(() => {
    function check() {
      let reason;
      try {
        reason = JSON.parse(
          room.localParticipant.metadata || "{}",
        ).disconnect_reason;
      } catch {
        return;
      }
      if (reason === "removed")
        onExit("The host removed you from this meeting.");
      if (reason === "meeting-ended") onExit("The host ended this meeting.");
    }
    room.on(RoomEvent.ParticipantMetadataChanged, check);
    check();
    return () => room.off(RoomEvent.ParticipantMetadataChanged, check);
  }, [room, onExit]);
  return null;
}
