"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import { api } from "@/services/api";
import MeetingRoom from "./MeetingRoom";

// Let the SDK adjust video quality to visible tile sizes and avoid sending
// unused camera layers, especially when a phone is watching a shared screen.
const roomOptions = { adaptiveStream: true, dynacast: true };
const serverInterrupted =
  "Connection to the meeting server was interrupted. Your call may still be active.";

export default function MeetingSession({
  meeting,
  session,
  choices,
  hostToken,
  onExit,
  shareHint,
}) {
  const [connect, setConnect] = useState(true);
  const [notice, setNotice] = useState("");
  const [ending, setEnding] = useState(false);
  const [cleanupFailed, setCleanupFailed] = useState(false);
  const leaving = useRef(false);
  const exited = useRef(false);
  const activeSession = useRef(session);
  const connected = useRef(false);
  const effectGeneration = useRef(0);

  const reportLeave = useCallback(async () => {
    try {
      await api.leave(meeting.meeting_code, activeSession.current);
      return "";
    } catch {
      return "You’ve disconnected, but your leave time could not be saved.";
    }
  }, [meeting.meeting_code]);

  const leave = useCallback(
    async (message = "") => {
      if (leaving.current || exited.current) return;
      leaving.current = true;
      // Disconnect media immediately; attendance reporting must not keep anyone in the call.
      setConnect(false);
      const attendanceMessage = await reportLeave();
      if (!exited.current) {
        exited.current = true;
        onExit(message || attendanceMessage);
      }
    },
    [onExit, reportLeave],
  );

  useEffect(() => {
    const generation = ++effectGeneration.current;
    const isCurrentGeneration = () => generation === effectGeneration.current;
    const pageExit = () => {
      api.leave(meeting.meeting_code, session, true).catch(() => {});
    };
    window.addEventListener("pagehide", pageExit);
    return () => {
      window.removeEventListener("pagehide", pageExit);
      // Strict Mode rehearses effect cleanup in development. Don't report that
      // rehearsal as a real departure if the same effect immediately reattaches.
      queueMicrotask(() => {
        if (isCurrentGeneration())
          api.leave(meeting.meeting_code, session, true).catch(() => {});
      });
    };
  }, [meeting.meeting_code, session]);

  useEffect(() => {
    let cancelled = false;
    let checking = false;
    const timer = setInterval(async () => {
      if (checking || leaving.current) return;
      checking = true;
      try {
        const current = await api.meeting(meeting.meeting_code);
        if (!cancelled)
          setNotice((previous) =>
            previous === serverInterrupted ? "" : previous,
          );
        if (!cancelled && current.status === "ended" && !leaving.current) {
          if (cleanupFailed) setConnect(false);
          else if (!ending) leave("The host ended this meeting.");
        }
      } catch {
        if (!cancelled) setNotice(serverInterrupted);
      } finally {
        checking = false;
      }
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [meeting.meeting_code, leave, ending, cleanupFailed]);

  async function end() {
    if (ending) return;
    setEnding(true);
    setNotice("");
    try {
      await api.end(meeting.meeting_code, hostToken);
      setCleanupFailed(false);
      await leave();
    } catch (err) {
      if (err.code === "MEDIA_CLEANUP_FAILED") {
        setCleanupFailed(true);
        setConnect(false);
        setNotice(
          "Meeting ended, but some connections may remain. Retry End Meeting to finish closing the room.",
        );
      } else setNotice(err.message);
    } finally {
      setEnding(false);
    }
  }

  function onConnected() {
    connected.current = true;
    api
      .connected(meeting.meeting_code, session)
      .catch(() =>
        setNotice(
          "You’re connected, but your attendance time could not be saved.",
        ),
      );
  }

  function onDisconnected() {
    if (!leaving.current && !ending && !cleanupFailed)
      leave(
        connected.current
          ? "You’ve disconnected from the meeting."
          : "Could not connect to the call. Please try joining again.",
      );
  }

  return (
    <LiveKitRoom
      token={session.livekit_token}
      serverUrl={session.livekit_url}
      connect={connect}
      options={roomOptions}
      audio={choices.audioEnabled}
      video={choices.videoEnabled}
      onConnected={onConnected}
      onDisconnected={onDisconnected}
      onError={() =>
        setNotice(
          "A call connection or device error occurred. Check your connection and browser permissions.",
        )
      }
      onMediaDeviceFailure={() =>
        setNotice(
          "Microphone or camera unavailable. Check browser permissions, or keep it off.",
        )
      }
      data-lk-theme="default"
      className="live-meeting"
    >
      <MeetingRoom
        meeting={meeting}
        isHost={session.participant.role === "host"}
        onLeave={() => leave()}
        onEnd={end}
        ending={ending}
        cleanupFailed={cleanupFailed}
        notice={notice}
        shareHint={shareHint}
      />
    </LiveKitRoom>
  );
}
