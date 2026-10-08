"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import Alert from "@/components/ui/Alert";
import Modal from "@/components/ui/Modal";

export default function AdminPage() {
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("meetings");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [allowed, setAllowed] = useState(false);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const user = await api.profile();
      setProfile(user);
      setAllowed(user.is_admin);
      if (!user.is_admin) {
        setItems([]);
        return;
      }
      setItems(
        await (tab === "meetings"
          ? api.adminMeetings(offset)
          : api.adminUsers(offset)),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tab, offset]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  async function end() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.adminEnd(target.meeting_code);
      setTarget(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell profile={profile} health={!!profile}>
      <div className="page-heading">
        <div>
          <h1>Site administration</h1>
          <p>Manage meetings across your Zoom Clone.</p>
        </div>
        {allowed && (
          <button
            className="button"
            onClick={refresh}
            disabled={loading || busy}
          >
            Refresh
          </button>
        )}
      </div>
      {!target && <Alert>{error}</Alert>}
      {loading ? (
        <p>Loading administration…</p>
      ) : !allowed ? (
        <section className="meetings-panel admin-access">
          <h2>Administrator access required</h2>
          <p>Sign in with the site owner account to continue.</p>
          <Link className="button primary" href="/signin">
            Sign In
          </Link>
        </section>
      ) : (
        <section className="meetings-panel">
          <div className="panel-heading">
            <div className="tabs" role="tablist" aria-label="Administration">
              {["meetings", "users"].map((value) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={tab === value}
                  disabled={busy}
                  onClick={() => {
                    setTab(value);
                    setOffset(0);
                  }}
                >
                  {value === "meetings" ? "All meetings" : "Accounts"}
                </button>
              ))}
            </div>
          </div>
          <div className="admin-list">
            {!items.length && <p>No entries on this page.</p>}
            {items.map((item) => (
              <article className="admin-row" key={item.id}>
                <div>
                  {tab === "meetings" ? (
                    <>
                      <h2>{item.title}</h2>
                      <p>
                        {item.meeting_code} · {item.status} · Owner #
                        {item.host_user_id}
                      </p>
                    </>
                  ) : (
                    <>
                      <h2>{item.display_name}</h2>
                      <p>
                        {item.email} ·{" "}
                        {item.is_admin
                          ? "Site administrator"
                          : item.id === 1
                            ? "Demo user"
                            : "Member"}
                      </p>
                    </>
                  )}
                </div>
                {tab === "meetings" && item.status !== "ended" && (
                  <button
                    className="button danger"
                    disabled={busy}
                    onClick={() => setTarget(item)}
                    aria-label={`End ${item.title}`}
                  >
                    End meeting
                  </button>
                )}
              </article>
            ))}
          </div>
          <div className="admin-pagination">
            <button
              className="button"
              disabled={offset === 0 || busy}
              onClick={() => setOffset(Math.max(0, offset - 100))}
            >
              Previous
            </button>
            <span>Page {offset / 100 + 1}</span>
            <button
              className="button"
              disabled={items.length < 100 || busy}
              onClick={() => setOffset(offset + 100)}
            >
              Next
            </button>
          </div>
        </section>
      )}
      {target && (
        <Modal
          title="End meeting as administrator"
          onClose={() => !busy && setTarget(null)}
        >
          <div className="modal-body">
            <p>End “{target.title}” for everyone? This cannot be undone.</p>
            <Alert>{error}</Alert>
          </div>
          <div className="modal-footer">
            <button
              className="button"
              disabled={busy}
              onClick={() => setTarget(null)}
            >
              Cancel
            </button>
            <button className="button danger" disabled={busy} onClick={end}>
              {busy ? "Ending…" : "End meeting for all"}
            </button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
