"use client";

import { useState } from "react";
import {
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  TrackToggle,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
  useTracks,
  StartAudio,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  ShieldCheck,
  ChevronDown,
  Mic,
  MicOff,
  Video,
  VideoOff,
  UsersRound,
  ArrowUpFromLine,
  Link2,
  Maximize2,
  X,
  LogOut,
} from "lucide-react";
import { formatCode, initials } from "@/utils/format";
import { api } from "@/services/api";
import Modal from "@/components/ui/Modal";
import InviteLink from "@/components/ui/InviteLink";
import {
  canShareScreen,
  screenShareUnavailable,
  screenShareError,
} from "@/utils/media";

export default function MeetingRoom({
  meeting,
  isHost,
  hostToken,
  onLeave,
  onEnd,
  ending,
  cleanupFailed,
  notice,
  shareHint,
}) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const participants = useParticipants();
  const { isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();
  const connection = useConnectionState();
  const [panel, setPanel] = useState(false);
  const [invite, setInvite] = useState(false);
  const [leaveDialog, setLeaveDialog] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const [moderating, setModerating] = useState(false);
  const [moderationNotice, setModerationNotice] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);
  async function moderate(target = null) {
    if (moderating) return;
    setModerating(true);
    setModerationNotice("");
    try {
      if (target) {
        await api.removeParticipant(
          meeting.meeting_code,
          target.identity,
          hostToken,
        );
        setRemoveTarget(null);
        setModerationNotice(
          `${target.name || "Guest"} was removed from the meeting.`,
        );
      } else {
        const result = await api.muteAll(meeting.meeting_code, hostToken);
        setModerationNotice(
          result.muted_count
            ? "Guest microphones muted. Guests can unmute themselves."
            : "No active guest microphones to mute.",
        );
      }
    } catch (error) {
      setModerationNotice(error.message);
    } finally {
      setModerating(false);
    }
  }
  const screenShareSupported = canShareScreen();
  const hasShare = tracks.some(
    (track) => track.source === Track.Source.ScreenShare,
  );
  const displayTracks = hasShare
    ? tracks.filter((track) => track.source === Track.Source.ScreenShare)
    : tracks;
  const deviceFailure = () =>
    setDeviceError(
      "Could not enable the device. Check your browser permissions and try again.",
    );
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setDeviceError("Full screen is not available in this browser.");
    }
  }
  return (
    <>
      <RoomAudioRenderer />
      <header className="room-header">
        <div className="room-title">
          <ShieldCheck size={17} className="room-shield" />
          <strong>{meeting.title}</strong>
          <span className="room-code">{formatCode(meeting.meeting_code)}</span>
          <ChevronDown size={13} />
        </div>
        <div className="room-header-actions">
          <span
            className={`connection-label ${connection === "connected" ? "connected" : ""}`}
          >
            <span className="status-dot" />
            {cleanupFailed ? "Meeting ended" : connection}
          </span>
          <button
            className="room-icon-button"
            onClick={fullscreen}
            aria-label="Toggle full screen"
          >
            <Maximize2 size={17} />
          </button>
        </div>
      </header>
      {(notice || deviceError || moderationNotice) && (
        <div className="room-notice" role="alert">
          {notice || deviceError || moderationNotice}
          {cleanupFailed && (
            <button onClick={onEnd} disabled={ending}>
              {ending ? "Finishing…" : "Retry End Meeting"}
            </button>
          )}
        </div>
      )}
      {shareHint && !isScreenShareEnabled && (
        <div className="share-hint">
          Ready to present? Choose <strong>Share Screen</strong> in the toolbar
          below.
        </div>
      )}
      <div className="room-body">
        <div className={`room-stage ${hasShare ? "screen-share-stage" : ""}`}>
          {displayTracks.length ? (
            <GridLayout tracks={displayTracks} className="meeting-grid">
              <ParticipantTile />
            </GridLayout>
          ) : (
            <div className="room-connecting">
              <span className="spinner" />
              <h2>
                {cleanupFailed
                  ? "Meeting ended"
                  : "Connecting to your meeting…"}
              </h2>
              <p>
                {cleanupFailed
                  ? "Retry End Meeting to close any remaining connections."
                  : "Your conversation is a moment away."}
              </p>
            </div>
          )}
          <StartAudio
            label="Click to hear meeting audio"
            className="button audio-play"
          />
        </div>
        {panel && (
          <aside className="participants-panel">
            <div className="participants-header">
              <h2>Participants ({participants.length})</h2>
              <button
                className="room-icon-button"
                onClick={() => setPanel(false)}
                aria-label="Close participants"
              >
                <X size={18} />
              </button>
            </div>
            {participants.map((participant) => {
              let role = "";
              try {
                role = JSON.parse(participant.metadata || "{}").role;
              } catch {}
              return (
                <div className="participant-item" key={participant.identity}>
                  <span className="avatar">
                    {initials(participant.name || "Guest")}
                  </span>
                  <div>
                    <strong>
                      {participant.name || "Guest"}
                      {participant.isLocal && " (you)"}
                    </strong>
                    <span className="small muted">
                      {role === "host" ? "Host" : "Guest"}
                    </span>
                  </div>
                  {participant.isMicrophoneEnabled ? (
                    <Mic size={15} />
                  ) : (
                    <MicOff size={15} />
                  )}
                  {isHost && role !== "host" && !participant.isLocal && (
                    <button
                      className="participant-remove"
                      disabled={moderating}
                      onClick={() => setRemoveTarget(participant)}
                      aria-label={`Remove ${participant.name || "Guest"}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
            {isHost && (
              <div className="participants-controls">
                <button
                  className="button"
                  disabled={moderating || cleanupFailed}
                  onClick={() => moderate()}
                >
                  {moderating ? "Please wait…" : "Mute All"}
                </button>
              </div>
            )}
          </aside>
        )}
      </div>
      <footer className="meeting-toolbar">
        <div className="toolbar-group">
          <TrackToggle
            source={Track.Source.Microphone}
            showIcon={false}
            className="toolbar-control"
            aria-label={
              isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"
            }
            onDeviceError={deviceFailure}
          >
            {isMicrophoneEnabled ? <Mic size={24} /> : <MicOff size={24} />}
            <span>{isMicrophoneEnabled ? "Mute" : "Unmute"}</span>
          </TrackToggle>
          <TrackToggle
            source={Track.Source.Camera}
            showIcon={false}
            className="toolbar-control"
            aria-label={isCameraEnabled ? "Stop video" : "Start video"}
            onDeviceError={deviceFailure}
          >
            {isCameraEnabled ? <Video size={24} /> : <VideoOff size={24} />}
            <span>{isCameraEnabled ? "Stop Video" : "Start Video"}</span>
          </TrackToggle>
        </div>
        <div className="toolbar-group center">
          <button
            className={`toolbar-control ${panel ? "selected" : ""}`}
            onClick={() => setPanel(!panel)}
            aria-label="Participants"
            aria-pressed={panel}
          >
            <span className="participant-control-icon">
              <UsersRound size={24} />
              <sup>{participants.length}</sup>
            </span>
            <span>Participants</span>
          </button>
          {screenShareSupported || isScreenShareEnabled ? (
            <TrackToggle
              source={Track.Source.ScreenShare}
              showIcon={false}
              className="toolbar-control share-control"
              aria-label={
                isScreenShareEnabled ? "Stop screen sharing" : "Share screen"
              }
              captureOptions={{ audio: true }}
              onDeviceError={(error) => setDeviceError(screenShareError(error))}
              onChange={(enabled) => {
                if (enabled) setDeviceError("");
              }}
            >
              <ArrowUpFromLine size={24} />
              <span>
                {isScreenShareEnabled ? "Stop Share" : "Share Screen"}
              </span>
            </TrackToggle>
          ) : (
            <button
              className="toolbar-control share-control"
              aria-label="Share screen"
              title="Screen sharing is unavailable in this browser"
              onClick={() => setDeviceError(screenShareUnavailable)}
            >
              <ArrowUpFromLine size={24} />
              <span>Share Screen</span>
            </button>
          )}
          <button
            className="toolbar-control"
            aria-label="Invite participants"
            onClick={() => setInvite(true)}
          >
            <Link2 size={24} />
            <span>Invite</span>
          </button>
        </div>
        <div className="toolbar-group">
          <button
            className="leave-button"
            onClick={() => (isHost ? setLeaveDialog(true) : onLeave())}
            disabled={ending}
          >
            {ending ? "Ending…" : isHost ? "End" : "Leave"}
            <LogOut size={15} />
          </button>
        </div>
      </footer>
      {invite && (
        <Modal
          title="Invite people to your meeting"
          onClose={() => setInvite(false)}
        >
          <div className="modal-body">
            <p>
              Meeting ID: <strong>{formatCode(meeting.meeting_code)}</strong>
            </p>
            <InviteLink link={meeting.invite_link} />
          </div>
          <div className="modal-footer">
            <button className="button primary" onClick={() => setInvite(false)}>
              Done
            </button>
          </div>
        </Modal>
      )}
      {removeTarget && (
        <Modal
          title={`Remove ${removeTarget.name || "Guest"}?`}
          onClose={() => !moderating && setRemoveTarget(null)}
        >
          <div className="modal-body">
            <p>
              This disconnects the guest from this meeting. They can join again
              using the invitation.
            </p>
          </div>
          <div className="modal-footer">
            <button
              className="button"
              disabled={moderating}
              onClick={() => setRemoveTarget(null)}
            >
              Cancel
            </button>
            <button
              className="button danger"
              disabled={moderating}
              onClick={() => moderate(removeTarget)}
            >
              {moderating ? "Removing…" : "Remove participant"}
            </button>
          </div>
        </Modal>
      )}
      {leaveDialog && (
        <Modal title="Ready to wrap up?" onClose={() => setLeaveDialog(false)}>
          <div className="modal-body">
            <p>
              End the meeting for everyone, or leave it running for your guests.
            </p>
            {cleanupFailed && (
              <p className="small muted">
                Choose End Meeting to retry closing remaining connections.
              </p>
            )}
          </div>
          <div className="modal-footer">
            <button className="button" onClick={onLeave}>
              Leave meeting
            </button>
            <button
              className="button danger"
              onClick={() => {
                setLeaveDialog(false);
                onEnd();
              }}
              disabled={ending}
            >
              End meeting for all
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
