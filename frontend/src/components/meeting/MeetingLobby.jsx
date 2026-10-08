"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  Video,
  Mic,
  Clock3,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { api } from "@/services/api";
import {
  getHostToken,
  saveHostToken,
  loadPreferences,
} from "@/services/storage";
import { accountToken } from "@/services/auth";
import { dateLabel, timeLabel, formatCode } from "@/utils/format";
import Alert from "@/components/ui/Alert";
import InviteLink from "@/components/ui/InviteLink";
import CameraPreview from "./CameraPreview";

// Load browser media code only on the meeting screen, never during server rendering.
const MeetingSession = dynamic(() => import("./MeetingSession"), {
  ssr: false,
  loading: () => <div className="room-loading">Opening your meeting…</div>,
});

export default function MeetingLobby({ code }) {
  const [meeting, setMeeting] = useState(null);
  const [hostToken, setHostToken] = useState(null);
  const [choices, setChoices] = useState({
    displayName: "Demo User",
    audioEnabled: true,
    videoEnabled: false,
  });
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [left, setLeft] = useState(false);
  const [shareHint, setShareHint] = useState(false);
  const meetingStatus = meeting?.status;
  const cameraError = useCallback(() => {
    setChoices((current) => ({ ...current, videoEnabled: false }));
    setError(
      "Camera unavailable. You can join with it off and enable it later.",
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHostToken(getHostToken(code));
    setChoices(loadPreferences());
    setShareHint(new URLSearchParams(window.location.search).has("share"));
    api
      .meeting(code)
      .then(async (data) => {
        if (accountToken() && !getHostToken(code)) {
          try {
            const access = await api.hostAccess(code);
            if (!cancelled) {
              saveHostToken(code, access.host_token);
              setHostToken(access.host_token);
            }
          } catch (err) {
            if (err.status !== 403 && !cancelled) setError(err.message);
          }
        }
        if (!cancelled) setMeeting(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (!meetingStatus || meetingStatus === "ended" || session) return;
    let cancelled = false;
    let checking = false;
    const timer = setInterval(async () => {
      if (checking) return;
      checking = true;
      try {
        const current = await api.meeting(code);
        if (!cancelled) setMeeting(current);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        checking = false;
      }
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [code, meetingStatus, session]);

  async function start() {
    setBusy(true);
    setError("");
    try {
      setMeeting(await api.start(code, hostToken));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function join(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    if (!choices.displayName.trim()) {
      setError("Enter your display name.");
      setBusy(false);
      return;
    }
    try {
      const data = await api.join(code, choices.displayName.trim(), hostToken);
      setSession(data);
      setLeft(false);
    } catch (err) {
      setError(
        err.code === "MEDIA_NOT_CONFIGURED"
          ? "Video calling is not available yet. You can still manage this meeting and share its invite."
          : err.message,
      );
      if (err.code === "WAITING_FOR_HOST" || err.code === "MEETING_ENDED")
        setMeeting(await api.meeting(code).catch(() => meeting));
    } finally {
      setBusy(false);
    }
  }

  async function onExit(message) {
    setSession(null);
    setLeft(true);
    setError(message || "");
    try {
      setMeeting(await api.meeting(code));
    } catch (err) {
      setError(err.message);
    }
  }

  async function end() {
    setBusy(true);
    setError("");
    try {
      setMeeting(await api.end(code, hostToken));
    } catch (err) {
      setError(err.message);
      if (err.code === "MEDIA_CLEANUP_FAILED")
        setMeeting(await api.meeting(code).catch(() => meeting));
    } finally {
      setBusy(false);
    }
  }

  if (session)
    return (
      <MeetingSession
        meeting={meeting}
        session={session}
        choices={choices}
        hostToken={hostToken}
        onExit={onExit}
        shareHint={shareHint}
      />
    );
  return (
    <div className="lobby-page">
      <header className="lobby-header">
        <Link className="wordmark" href="/">
          zoom<span>clone</span>
        </Link>
        <Link className="back-link" href="/">
          <ArrowLeft size={16} />
          Back to Home
        </Link>
      </header>
      <main className="lobby-main">
        {loading ? (
          <div className="standalone">
            <LoaderCircle className="spin" size={32} />
            <h2>Finding your meeting…</h2>
          </div>
        ) : !meeting ? (
          <div className="lobby-not-found">
            <h1>We couldn’t open this meeting</h1>
            <Alert>{error}</Alert>
            <Link className="button primary" href="/">
              Back to Home
            </Link>
          </div>
        ) : (
          <>
            <div className="lobby-title">
              <span className="eyebrow">
                {left
                  ? "THANKS FOR THE CONVERSATION"
                  : "A MOMENT BEFORE YOU CONNECT"}
              </span>
              <h1>{meeting.title}</h1>
              <p>
                Meeting ID: {formatCode(meeting.meeting_code)}
                {hostToken && (
                  <span className="host-badge">
                    <ShieldCheck size={13} />
                    You’re the host
                  </span>
                )}
              </p>
            </div>
            <div className="lobby-grid">
              <div>
                <CameraPreview
                  enabled={
                    choices.videoEnabled && meeting.status === "live" && !left
                  }
                  displayName={choices.displayName}
                  onUnavailable={cameraError}
                />
                <div className="preview-caption">
                  <ShieldCheck size={15} />
                  Your camera preview is only visible to you.
                </div>
              </div>
              <section className="lobby-details">
                {meeting.status === "ended" ? (
                  <>
                    <div className="lobby-state-icon">
                      <Video size={28} />
                    </div>
                    <h2>This meeting has ended</h2>
                    <p className="muted">
                      A good conversation is worth making time for. We’ll see
                      you at the next one.
                    </p>
                    <Alert>{error}</Alert>
                    {hostToken && error && (
                      <button className="button" onClick={end} disabled={busy}>
                        {busy ? "Finishing…" : "Retry End Meeting"}
                      </button>
                    )}
                    <Link href="/" className="button primary full-width">
                      Back to Home
                    </Link>
                  </>
                ) : meeting.status === "scheduled" ? (
                  <>
                    <div className="lobby-state-icon">
                      <Clock3 size={29} />
                    </div>
                    <h2>
                      {hostToken
                        ? "Ready when you are"
                        : "Waiting for the host"}
                    </h2>
                    <p className="muted">
                      {hostToken
                        ? "Start the meeting to let your guests join."
                        : "You’re in the right place. This screen updates when the host starts the meeting."}
                    </p>
                    <div className="scheduled-detail">
                      {dateLabel(meeting.scheduled_start_at)} ·{" "}
                      {timeLabel(meeting.scheduled_start_at)}
                      <br />
                      <span className="small muted">
                        {meeting.duration_minutes} minute meeting
                      </span>
                    </div>
                    <Alert>{error}</Alert>
                    {hostToken ? (
                      <button
                        className="button primary full-width"
                        onClick={start}
                        disabled={busy}
                      >
                        {busy ? "Starting…" : "Start meeting"}
                      </button>
                    ) : (
                      <p className="waiting-label">
                        <span className="spinner" />
                        We’ll let you in when it starts.
                      </p>
                    )}
                  </>
                ) : (
                  <form onSubmit={join}>
                    <h2>
                      {left
                        ? "You’ve left the meeting"
                        : "Join the conversation"}
                    </h2>
                    <p className="muted">
                      {left
                        ? "You can rejoin while the meeting is still live."
                        : "Choose how you’d like to say hello."}
                    </p>
                    <label htmlFor="your-name">Your name</label>
                    <input
                      id="your-name"
                      required
                      maxLength={80}
                      value={choices.displayName}
                      onChange={(e) =>
                        setChoices({ ...choices, displayName: e.target.value })
                      }
                    />
                    <div className="join-preferences">
                      <label>
                        <input
                          type="checkbox"
                          checked={choices.audioEnabled}
                          onChange={(e) =>
                            setChoices({
                              ...choices,
                              audioEnabled: e.target.checked,
                            })
                          }
                        />
                        <Mic size={17} />
                        Join with microphone on
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={choices.videoEnabled}
                          onChange={(e) => {
                            setChoices({
                              ...choices,
                              videoEnabled: e.target.checked,
                            });
                            setLeft(false);
                          }}
                        />
                        <Video size={17} />
                        Join with camera on
                      </label>
                    </div>
                    <Alert>{error}</Alert>
                    {shareHint && (
                      <p className="small muted">
                        Choose Share Screen from the toolbar after joining.
                      </p>
                    )}
                    <button
                      className="button primary full-width"
                      disabled={busy}
                    >
                      {busy
                        ? "Joining…"
                        : left
                          ? "Rejoin meeting"
                          : "Join meeting"}
                    </button>
                    {hostToken && (
                      <button
                        className="button full-width lobby-end"
                        type="button"
                        onClick={end}
                        disabled={busy}
                      >
                        End meeting
                      </button>
                    )}
                  </form>
                )}
                <div className="lobby-invite">
                  <InviteLink link={meeting.invite_link} />
                  {meeting.description && (
                    <p className="small muted meeting-description">
                      {meeting.description}
                    </p>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </main>
      <footer className="lobby-footer">
        Different places. Same conversation.
      </footer>
    </div>
  );
}
