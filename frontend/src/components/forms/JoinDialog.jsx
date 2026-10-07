"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/services/api";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";

export default function JoinDialog({ onClose, share = false }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const meeting = await api.lookup(input.trim());
      if (meeting.status === "ended")
        throw new Error(
          "This meeting has ended. Ask the host for a new invite.",
        );
      router.push(`/join/${meeting.meeting_code}${share ? "?share=1" : ""}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <Modal
      title={share ? "Share your screen" : "Join a meeting"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          <p className="muted">
            {share
              ? "Join a meeting, then choose Share Screen from the toolbar."
              : "Enter a meeting ID or paste an invite link to get started."}
          </p>
          <label htmlFor="meeting-input">Meeting ID or invite link</label>
          <input
            id="meeting-input"
            autoFocus
            required
            maxLength={1000}
            placeholder="123 4567 8901"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <p className="small muted">Use an invite from this Zoom Clone.</p>
          <Alert>{error}</Alert>
        </div>
        <div className="modal-footer">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Finding meeting…" : "Continue"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
