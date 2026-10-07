"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  CalendarDays,
  Settings,
  Search,
  HelpCircle,
  Video,
  ChevronRight,
} from "lucide-react";
import { initials } from "@/utils/format";
import Modal from "@/components/ui/Modal";

const navigation = [
  { href: "/", label: "Home", icon: Home },
  { href: "/meetings", label: "Meetings", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({ children, profile, health }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [help, setHelp] = useState(false);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="wordmark" href="/" aria-label="Zoom Clone Home">
          zoom<span>clone</span>
        </Link>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-item ${pathname === href ? "active" : ""}`}
              aria-current={pathname === href ? "page" : undefined}
            >
              <Icon size={20} />
              {label}
              {pathname === href && (
                <ChevronRight size={15} className="nav-arrow" />
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <div className="workspace-note-icon">
              <Video size={19} />
            </div>
            <strong>A little closer, together.</strong>
            <p>
              Your next conversation is
              <br />
              just a click away.
            </p>
          </div>
          <span className="project-label">Built for the assignment</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="topbar-title">Personal workspace</span>
          <form
            className="search-box"
            onSubmit={(event) => {
              event.preventDefault();
              router.push(`/meetings?search=${encodeURIComponent(query)}`);
            }}
          >
            <Search size={17} />
            <input
              aria-label="Search meetings"
              placeholder="Search meetings"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <div className="topbar-actions">
            <button
              className="icon-button"
              aria-label="Meeting help"
              onClick={() => setHelp(true)}
            >
              <HelpCircle size={21} />
            </button>
            <Link href="/settings" className="avatar" aria-label="Open profile">
              {initials(profile?.display_name)}
            </Link>
          </div>
        </header>
        <main className="page-content">{children}</main>
        <footer className="app-footer">
          <span>
            <span className={`status-dot ${health ? "online" : ""}`} />
            {health
              ? "Meeting server connected"
              : "Connecting to meeting server"}
          </span>
          <span>Zoom-inspired · Made for simple conversations</span>
        </footer>
      </div>
      {help && (
        <Modal
          title="Make your next meeting simple"
          onClose={() => setHelp(false)}
        >
          <div className="modal-body">
            <p>
              <strong>New Meeting</strong> starts an instant meeting. Copy the
              invite link and send it to your guests.
            </p>
            <p>
              <strong>Join</strong> accepts this app’s meeting ID or invite
              link. Enter your name before joining.
            </p>
            <p>
              <strong>Schedule</strong> saves a future meeting. The host starts
              it from Upcoming; guests wait until it starts.
            </p>
            <p>
              <strong>Share screen</strong> lets you join an existing meeting.
              Choose Share Screen in the meeting toolbar.
            </p>
          </div>
          <div className="modal-footer">
            <button className="button primary" onClick={() => setHelp(false)}>
              Got it
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
