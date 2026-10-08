"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, RefreshCw } from "lucide-react";
import useDashboard from "@/hooks/useDashboard";
import AppShell from "@/components/layout/AppShell";
import Alert from "@/components/ui/Alert";
import ScheduleDialog from "@/components/forms/ScheduleDialog";
import MeetingList from "./MeetingList";

export default function MeetingsPage() {
  const data = useDashboard();
  const searchParams = useSearchParams();
  const query = searchParams.get("search") || "";
  const [search, setSearch] = useState(query);
  useEffect(() => {
    setSearch(query);
  }, [query]);
  const [tab, setTab] = useState("upcoming");
  const [schedule, setSchedule] = useState(false);
  const filter = search.toLowerCase().trim();
  const meetings = (tab === "upcoming" ? data.upcoming : data.recent).filter(
    (meeting) =>
      `${meeting.title} ${meeting.meeting_code} ${meeting.description}`
        .toLowerCase()
        .includes(filter),
  );
  return (
    <AppShell profile={data.profile} health={data.health}>
      <div className="page-heading">
        <div>
          <h1>Meetings</h1>
          <p>View and manage your upcoming and recent meetings.</p>
        </div>
        <button className="button primary" onClick={() => setSchedule(true)}>
          <Plus size={17} />
          Schedule a meeting
        </button>
      </div>
      <Alert>{data.error}</Alert>
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
          <button
            className="icon-button"
            aria-label="Refresh meetings"
            onClick={data.refresh}
            disabled={data.loading}
          >
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="list-search">
          <Search size={18} />
          <input
            aria-label="Filter meetings"
            placeholder="Filter by title or meeting ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <MeetingList
          meetings={meetings}
          recent={tab === "recent"}
          loading={data.loading}
          onSchedule={() => setSchedule(true)}
        />
      </section>
      {schedule && (
        <ScheduleDialog
          onClose={() => setSchedule(false)}
          onCreated={data.refresh}
        />
      )}
    </AppShell>
  );
}
