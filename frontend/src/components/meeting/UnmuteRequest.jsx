"use client";
import { useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";

export default function UnmuteRequest() {
  const room = useRoomContext();
  const seen = useRef(null);
  const [request, setRequest] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    function check() {
      let metadata;
      try {
        metadata = JSON.parse(room.localParticipant.metadata || "{}");
      } catch {
        return;
      }
      if (metadata.disconnect_reason) {
        setRequest(null);
        return;
      }
      if (!metadata.unmute_request || metadata.unmute_request === seen.current)
        return;
      seen.current = metadata.unmute_request;
      if (!room.localParticipant.isMicrophoneEnabled) {
        setRequest(metadata.unmute_request);
        setError("");
      }
    }
    room.on(RoomEvent.ParticipantMetadataChanged, check);
    check();
    return () => room.off(RoomEvent.ParticipantMetadataChanged, check);
  }, [room]);
  async function accept() {
    setBusy(true);
    setError("");
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      setRequest(null);
    } catch {
      setError(
        "Could not enable your microphone. Check browser permission and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!request) return null;
  return (
    <Modal
      title="The host asks you to unmute"
      onClose={() => !busy && setRequest(null)}
    >
      <div className="modal-body">
        <p>Would you like to turn on your microphone? You can stay muted.</p>
        <Alert>{error}</Alert>
      </div>
      <div className="modal-footer">
        <button
          className="button"
          disabled={busy}
          onClick={() => setRequest(null)}
        >
          Stay muted
        </button>
        <button className="button primary" disabled={busy} onClick={accept}>
          {busy ? "Enabling…" : "Unmute"}
        </button>
      </div>
    </Modal>
  );
}
