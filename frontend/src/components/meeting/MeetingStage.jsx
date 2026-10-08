"use client";

import { ParticipantTile, StartAudio } from "@livekit/components-react";
import { Track } from "livekit-client";
import ScreenShareView from "./ScreenShareView";

export default function MeetingStage({ tracks, cleanupFailed }) {
  const cameras = tracks.filter(
    (track) => track.source === Track.Source.Camera,
  );
  const shares = tracks.filter(
    (track) => track.source === Track.Source.ScreenShare,
  );
  const sharing = shares.length > 0;

  return (
    <div className={`room-stage ${sharing ? "screen-share-stage" : ""}`}>
      {sharing ? (
        <div className="presentation-layout" key="presentation">
          <div className="shared-screen-grid" aria-label="Shared screens">
            {shares.map((track) => (
              <ScreenShareView
                key={`${track.participant.identity}:${track.publication.trackSid}`}
                track={track}
              />
            ))}
          </div>
          <div
            className="camera-strip"
            role="region"
            aria-label="Participant cameras"
          >
            {cameras.map((track) => (
              <ParticipantTile
                key={`${track.participant.identity}:camera`}
                trackRef={track}
              />
            ))}
          </div>
        </div>
      ) : cameras.length ? (
        // Stable participant keys handle camera placeholders becoming live
        // tracks without the SDK grid's stale-array reordering state.
        <div
          key="camera-gallery"
          className="meeting-grid camera-gallery"
          style={{
            "--camera-columns": Math.min(
              3,
              Math.ceil(Math.sqrt(cameras.length)),
            ),
          }}
        >
          {cameras.map((track) => (
            <ParticipantTile
              key={`${track.participant.identity}:camera`}
              trackRef={track}
            />
          ))}
        </div>
      ) : (
        <div className="room-connecting">
          <span className="spinner" />
          <h2>
            {cleanupFailed ? "Meeting ended" : "Connecting to your meeting…"}
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
  );
}
