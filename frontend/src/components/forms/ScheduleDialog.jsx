"use client";

import { useState } from "react";
import { CalendarCheck, Clock3 } from "lucide-react";
import { api } from "@/services/api";
import { saveHostToken } from "@/services/storage";
import {
  dateLabel,
  timeLabel,
  formatCode,
  localDateTime,
} from "@/utils/format";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";
import InviteLink from "@/components/ui/InviteLink";

export default function ScheduleDialog({ onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState(() =>
    localDateTime(new Date(Date.now() + 60 * 60 * 1000)),
  );
  const [duration, setDuration] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Give your meeting a title.");
      return;
    }
    const date = new Date(start);
    if (Number.isNaN(date.getTime()) || date <= new Date()) {
      setError("Choose a date and time in the future.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.schedule({
        title: title.trim(),
        description: description.trim(),
        scheduled_start_at: date.toISOString(),
        duration_minutes: Number(duration),
      });
      saveHostToken(result.meeting.meeting_code, result.host_token);
      setCreated(result.meeting);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={created ? "Your meeting is scheduled" : "Schedule a meeting"}
      onClose={onClose}
    >
      {created ? (
        <>
          <div className="modal-body">
            <div className="success-symbol">
              <CalendarCheck size={28} />
            </div>
            <h3>{created.title}</h3>
            <p className="muted">
              <Clock3 size={15} className="inline-icon" />{" "}
              {dateLabel(created.scheduled_start_at)} ·{" "}
              {timeLabel(created.scheduled_start_at)} ·{" "}
              {created.duration_minutes} min
            </p>
            <p className="small">
              Meeting ID: <strong>{formatCode(created.meeting_code)}</strong>
            </p>
            <InviteLink link={created.invite_link} />
            <p className="small muted">
              Keep this tab open to retain your host access. Start your meeting
              from Upcoming when you’re ready.
            </p>
          </div>
          <div className="modal-footer">
            <button className="button primary" onClick={onClose}>
              Done
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={submit}>
          <div className="modal-body form-stack">
            <label htmlFor="topic">Topic</label>
            <input
              id="topic"
              autoFocus
              required
              maxLength={120}
              placeholder="e.g. Team catch-up"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <label htmlFor="description">
              Description{" "}
              <span className="muted normal-weight">(optional)</span>
            </label>
            <textarea
              id="description"
              rows={3}
              maxLength={2000}
              placeholder="What will you discuss?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="form-row">
              <div>
                <label htmlFor="start">Start date & time</label>
                <input
                  id="start"
                  type="datetime-local"
                  required
                  value={start}
                  min={localDateTime(new Date())}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="duration">Duration</label>
                <select
                  id="duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
            </div>
            <p className="small muted">
              Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}.
              Guests wait until you start the meeting.
            </p>
            <Alert>{error}</Alert>
          </div>
          <div className="modal-footer">
            <button type="button" className="button" onClick={onClose}>
              Cancel
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? "Scheduling…" : "Schedule"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
