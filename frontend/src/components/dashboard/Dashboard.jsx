"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw, Video } from "lucide-react";
import useDashboard from "@/hooks/useDashboard";
import { api } from "@/services/api";
import { saveHostToken } from "@/services/storage";
import AppShell from "@/components/layout/AppShell";
import Alert from "@/components/ui/Alert";
import JoinDialog from "@/components/forms/JoinDialog";
import ScheduleDialog from "@/components/forms/ScheduleDialog";
import ActionTiles from "./ActionTiles";
import ProfileCard from "./ProfileCard";
import MeetingList from "./MeetingList";

export default function Dashboard() {
  const data = useDashboard();
  const router = useRouter();
  const [dialog, setDialog] = useState(null);
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
    <AppShell
      profile={data.profile}
      health={data.health}
      onSchedule={() => setDialog("schedule")}
      onJoin={() => setDialog("join")}
      onNew={newMeeting}
    >
      <Alert>{error || data.error}</Alert>
      <div className="portal-dashboard">
        <div className="portal-main-column">
          <ProfileCard profile={data.profile} />
          <section className="portal-card meeting-welcome">
            <div>
              <span className="workplace-label">
                <Video size={24} /> Workplace Meetings
              </span>
              <h2>Meet. Connect. Collaborate.</h2>
              <p>
                Start a meeting instantly or schedule your next conversation.
                Invite anyone with a meeting link.
              </p>
              <button
                className="button primary"
                onClick={() => setDialog("schedule")}
              >
                Schedule a meeting
              </button>
            </div>
            <div className="meeting-illustration" aria-hidden="true">
              <div className="illustration-title">zoom</div>
              <div className="illustration-grid">
                <span>A</span>
                <span>B</span>
                <span>C</span>
                <span>D</span>
              </div>
              <div className="illustration-toolbar">
                <span>Audio</span>
                <span>Video</span>
                <span>Participants</span>
              </div>
            </div>
          </section>
          <section className="portal-card recent-activity">
            <div className="portal-card-heading">
              <h2>Recent activity</h2>
              <button
                className="icon-button"
                onClick={data.refresh}
                disabled={data.loading}
                aria-label="Refresh meetings"
              >
                <RefreshCw size={18} className={data.loading ? "spin" : ""} />
              </button>
            </div>
            <MeetingList
              meetings={data.recent.slice(0, 3)}
              recent
              loading={data.loading}
            />
          </section>
        </div>
        <div className="portal-side-column">
          <section
            className="portal-card quick-actions"
            aria-label="Meeting actions"
          >
            <ActionTiles
              busy={busy}
              onNew={newMeeting}
              onJoin={() => setDialog("join")}
              onSchedule={() => setDialog("schedule")}
            />
            <div className="actions-caption">
              <h2>Start your next meeting</h2>
              <p>Create a unique meeting ID and shareable invite.</p>
            </div>
          </section>
          <section className="portal-card upcoming-card">
            <div className="portal-card-heading">
              <h2>Meetings</h2>
              <Link href="/meetings" className="text-link">
                View Meetings
              </Link>
            </div>
            <h3 className="upcoming-label">Upcoming meetings</h3>
            <MeetingList
              meetings={data.upcoming.slice(0, 3)}
              loading={data.loading}
              onSchedule={() => setDialog("schedule")}
            />
          </section>
        </div>
      </div>
      {dialog === "join" && <JoinDialog onClose={() => setDialog(null)} />}
      {dialog === "schedule" && (
        <ScheduleDialog
          onClose={() => setDialog(null)}
          onCreated={data.refresh}
        />
      )}
    </AppShell>
  );
}
