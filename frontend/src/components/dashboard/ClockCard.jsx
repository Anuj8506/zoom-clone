"use client";

import { useEffect, useState } from "react";
import { Sun, CalendarDays } from "lucide-react";
import Link from "next/link";
import { timeLabel } from "@/utils/format";

export default function ClockCard({ nextMeeting }) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <section className="clock-card" aria-label="Your day">
      <div className="clock-landscape">
        <div className="clock-top">
          <span>
            <Sun size={16} /> A fresh moment to connect
          </span>
          <span className="clock-live">TODAY</span>
        </div>
        <div className="clock-time">
          {now
            ? now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })
            : "--:--"}
        </div>
        <div className="clock-date">
          {now
            ? now.toLocaleDateString([], {
                weekday: "long",
                month: "long",
                day: "numeric",
              })
            : "Your local time"}
        </div>
        <span className="clock-timezone">
          {now
            ? Intl.DateTimeFormat()
                .resolvedOptions()
                .timeZone.replaceAll("_", " ")
            : ""}
        </span>
      </div>
      <div className="clock-next">
        <div className="calendar-symbol">
          <CalendarDays size={21} />
        </div>
        <div>
          <span className="eyebrow">
            {nextMeeting
              ? "NEXT ON YOUR CALENDAR"
              : "A LITTLE ROOM IN YOUR DAY"}
          </span>
          <strong>
            {nextMeeting ? nextMeeting.title : "Your next conversation awaits"}
          </strong>
          <span className="small muted">
            {nextMeeting
              ? `${timeLabel(nextMeeting.scheduled_start_at)} · ${nextMeeting.duration_minutes} min`
              : "Start a meeting whenever you’re ready."}
          </span>
        </div>
        {nextMeeting && (
          <Link
            href={`/meeting/${nextMeeting.meeting_code}`}
            className="text-link"
          >
            View
          </Link>
        )}
      </div>
    </section>
  );
}
