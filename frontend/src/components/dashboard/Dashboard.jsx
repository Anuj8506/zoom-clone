"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import useDashboard from "@/hooks/useDashboard";
import { api } from "@/services/api";
import { saveHostToken } from "@/services/storage";
import AppShell from "@/components/layout/AppShell";
import Alert from "@/components/ui/Alert";
import JoinDialog from "@/components/forms/JoinDialog";
import ScheduleDialog from "@/components/forms/ScheduleDialog";
import ActionTiles from "./ActionTiles";
import ClockCard from "./ClockCard";
import MeetingList from "./MeetingList";

export default function Dashboard() {
  const data = useDashboard();
  const router = useRouter();
  const [dialog, setDialog] = useState(null);
  const [tab, setTab] = useState("upcoming");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function newMeeting() {
    setBusy(true);
    setError("");
    try {
      const result = await api.instant();
      saveHostToken(result.meeting.meeting_code, result.host_token);
      router.push(`/meeting/${result.meeting.meeting_code}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <AppShell profile={data.profile} health={data.health}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LET’S MAKE ROOM FOR CONNECTION</div>
          <h1>
            Welcome back<span className="heading-dot">.</span>
          </h1>
          <p>Good conversations start with a simple hello.</p>
        </div>
        <button
          className="icon-button outlined"
          onClick={data.refresh}
          disabled={data.loading}
          aria-label="Refresh meetings"
        >
          <RefreshCw size={18} className={data.loading ? "spin" : ""} />
        </button>
      </div>
      <Alert>{error || data.error}</Alert>
      <div className="home-hero">
        <section className="quick-actions">
          <div className="section-overline">WHAT WOULD YOU LIKE TO DO?</div>
          <ActionTiles
            busy={busy}
            onNew={newMeeting}
            onJoin={() => setDialog("join")}
            onSchedule={() => setDialog("schedule")}
            onShare={() => setDialog("share")}
          />
        </section>
        <ClockCard nextMeeting={data.upcoming[0]} />
      </div>
      <section className="meetings-panel">
        <div className="panel-heading">
          <div className="tabs" role="tablist" aria-label="Meeting history">
            <button
              role="tab"
              aria-selected={tab === "upcoming"}
              onClick={() => setTab("upcoming")}
            >
              Upcoming<span>{data.upcoming.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={tab === "recent"}
              onClick={() => setTab("recent")}
            >
              Recent<span>{data.recent.length}</span>
            </button>
          </div>
          <Link href="/meetings" className="text-link">
            View all meetings
            <ArrowRight size={15} />
          </Link>
        </div>
        <MeetingList
          meetings={
            tab === "upcoming"
              ? data.upcoming.slice(0, 3)
              : data.recent.slice(0, 3)
          }
          recent={tab === "recent"}
          loading={data.loading}
          onSchedule={() => setDialog("schedule")}
        />
      </section>
      <div className="home-note">
        <span className="note-line" />
        <p>Different places. Same conversation.</p>
        <span className="note-line" />
      </div>
      {(dialog === "join" || dialog === "share") && (
        <JoinDialog
          share={dialog === "share"}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "schedule" && (
        <ScheduleDialog
          onClose={() => setDialog(null)}
          onCreated={data.refresh}
        />
      )}
    </AppShell>
  );
}
