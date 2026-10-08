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
  ChevronRight,
  ChevronDown,
  MessageCircle,
} from "lucide-react";
import { initials } from "@/utils/format";
import Modal from "@/components/ui/Modal";
import PortalFooter from "./PortalFooter";

const navigation = [
  { href: "/", label: "Home", icon: Home },
  { href: "/meetings", label: "Meetings", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({
  children,
  profile,
  health,
  onSchedule,
  onJoin,
  onNew,
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [help, setHelp] = useState(false);
  return (
    <div className="app-shell portal-shell">
      <div className="utility-bar">
        <span>Zoom Workplace</span>
        <button onClick={() => setHelp(true)}>Support</button>
      </div>
      <header className="portal-header">
        <Link className="wordmark" href="/" aria-label="Zoom Clone Home">
          zoom
        </Link>
        <span className="portal-product">Workplace</span>
        <nav className="header-meeting-actions" aria-label="Meeting shortcuts">
          {onSchedule && (
            <button aria-label="Schedule meeting shortcut" onClick={onSchedule}>
              Schedule
            </button>
          )}
          {onJoin && (
            <button aria-label="Join meeting shortcut" onClick={onJoin}>
              Join
            </button>
          )}
          {onNew && (
            <button onClick={onNew}>
              Host <ChevronDown size={14} />
            </button>
          )}
          <Link href="/meetings">
            Web App <ChevronDown size={14} />
          </Link>
          <Link href="/settings" className="avatar" aria-label="Open profile">
            {initials(profile?.display_name)}
          </Link>
        </nav>
      </header>
      <div className="portal-body">
        <aside className="sidebar">
          <nav aria-label="Main navigation">
            {navigation.map(({ href, label, icon: Icon }) => (
              <div key={href}>
                {href === "/meetings" && (
                  <div className="workspace-label">My Products</div>
                )}
                {href === "/settings" && (
                  <div className="sidebar-group">
                    <ChevronDown size={16} /> My Account
                  </div>
                )}
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
              </div>
            ))}
          </nav>
          <button className="sidebar-support" onClick={() => setHelp(true)}>
            <ChevronDown size={16} /> Support
          </button>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <span className="topbar-title">My workspace</span>
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
          </footer>
        </div>
      </div>
      <PortalFooter onHelp={() => setHelp(true)} />
      <button
        className="floating-help"
        aria-label="Open meeting support"
        onClick={() => setHelp(true)}
      >
        <MessageCircle size={27} />
      </button>
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
              <strong>Share screen</strong> shares your display during a call.
              Choose Share Screen in the meeting toolbar after joining.
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
