"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Video,
  Copy,
  Check,
  ArrowUpRight,
  PackageOpen,
} from "lucide-react";
import { copyText, dateLabel, formatCode, timeLabel } from "@/utils/format";
import { getHostToken } from "@/services/storage";
import Alert from "@/components/ui/Alert";

function MeetingRow({ meeting, recent }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  async function copy() {
    try {
      await copyText(meeting.invite_link);
      setCopied(true);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }
  const isDemo =
    meeting.meeting_code.startsWith("9100000000") &&
    Number(meeting.meeting_code.slice(-1)) <= 4;
  return (
    <div className="meeting-row">
      <div className={`meeting-row-icon ${recent ? "recent" : ""}`}>
        <Video size={20} />
      </div>
      <div className="meeting-row-details">
        <div className="meeting-title-line">
          <h3>{meeting.title}</h3>
          {isDemo && <span className="demo-badge">DEMO</span>}
        </div>
        <p>
          {dateLabel(recent ? meeting.ended_at : meeting.scheduled_start_at)} ·{" "}
          {timeLabel(recent ? meeting.ended_at : meeting.scheduled_start_at)}
          {!recent && ` · ${meeting.duration_minutes} min`}
        </p>
        <span className="small muted">
          Meeting ID: {formatCode(meeting.meeting_code)}
        </span>
        <Alert>{error}</Alert>
      </div>
      <div className="meeting-row-actions">
        {recent ? (
          <span className="ended-pill">Completed</span>
        ) : (
          <>
            <button
              className="icon-button"
              aria-label={
                copied
                  ? `Invite copied for ${meeting.title}`
                  : `Copy invite for ${meeting.title}`
              }
              title="Copy invite"
              onClick={copy}
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
            <Link
              className="button compact"
              href={`/meeting/${meeting.meeting_code}`}
            >
              {getHostToken(meeting.meeting_code) ? "Start" : "View"}
              <ArrowUpRight size={14} />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function MeetingList({
  meetings,
  recent = false,
  loading,
  onSchedule,
}) {
  if (loading && !meetings.length)
    return (
      <div className="list-loading" role="status">
        <span className="spinner" />
        Loading your meetings…
      </div>
    );
  if (!meetings.length)
    return (
      <div className="empty-state">
        {recent ? (
          <PackageOpen size={80} strokeWidth={1.3} />
        ) : (
          <CalendarDays size={30} />
        )}
        <h3>{recent ? "No recent activity" : "Your calendar is clear"}</h3>
        <p>
          {recent
            ? "Completed meetings will appear here."
            : "Make space for your next conversation."}
        </p>
        {!recent && onSchedule && (
          <button className="button" onClick={onSchedule}>
            Schedule a meeting
          </button>
        )}
      </div>
    );
  return (
    <div className="meeting-list">
      {meetings.map((meeting) => (
        <MeetingRow key={meeting.id} meeting={meeting} recent={recent} />
      ))}
    </div>
  );
}
