"use client";

import { useEffect, useRef } from "react";
import { VideoOff } from "lucide-react";
import { initials } from "@/utils/format";

export default function CameraPreview({ enabled, displayName, onUnavailable }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stream;
    async function preview() {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("Camera access requires localhost or HTTPS.");
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      } catch {
        if (!cancelled) onUnavailable();
      }
    }
    preview();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [enabled, onUnavailable]);
  return (
    <div className="camera-preview">
      <video
        ref={videoRef}
        muted
        playsInline
        className={enabled ? "" : "hidden"}
      />
      {!enabled && (
        <div className="camera-off">
          <span className="preview-avatar">
            {initials(displayName || "Guest")}
          </span>
          <span>
            <VideoOff size={16} />
            Camera is off
          </span>
        </div>
      )}
      <span className="preview-name">{displayName || "Your preview"}</span>
      <span className="preview-badge">PREVIEW</span>
    </div>
  );
}
