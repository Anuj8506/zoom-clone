"use client";
import { useEffect, useRef, useState } from "react";
import { VideoTrack } from "@livekit/components-react";
import { Maximize2, Minimize2 } from "lucide-react";

export default function ScreenShareView({ track }) {
  const container = useRef(null);
  const [fit, setFit] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const changed = () => {
      if (!document.fullscreenElement) setExpanded(false);
    };
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  async function fullscreen() {
    if (expanded) {
      if (document.fullscreenElement) await document.exitFullscreen();
      setExpanded(false);
      return;
    }
    setExpanded(true);
    try {
      await container.current.requestFullscreen();
    } catch {
      /* Expanded in-page view also works on browsers without fullscreen. */
    }
  }
  return (
    <section
      ref={container}
      className={`screen-view ${fit ? "fit-screen" : "fit-width"} ${expanded ? "expanded-share" : ""}`}
      aria-label={`${track.participant.name || "Participant"}'s shared screen`}
    >
      <div className="screen-view-controls">
        <span>{track.participant.name || "Participant"}’s screen</span>
        <button onClick={() => setFit(!fit)}>
          {fit ? "Fit width" : "Fit screen"}
        </button>
        <button
          onClick={fullscreen}
          aria-label={
            expanded
              ? "Exit shared screen full screen"
              : "Full screen shared screen"
          }
        >
          {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
      <div className="screen-video">
        <VideoTrack trackRef={track} />
      </div>
    </section>
  );
}
