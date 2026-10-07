"use client";

import { useEffect, useState } from "react";
import { UserRound, Mic, Video } from "lucide-react";
import useDashboard from "@/hooks/useDashboard";
import AppShell from "@/components/layout/AppShell";
import Alert from "@/components/ui/Alert";
import { loadPreferences, savePreferences } from "@/services/storage";
import { initials } from "@/utils/format";

export default function SettingsPage() {
  const data = useDashboard();
  const [preferences, setPreferences] = useState({
    displayName: "Demo User",
    audioEnabled: true,
    videoEnabled: false,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setPreferences(loadPreferences());
  }, []);
  function update(key, value) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }
  function submit(event) {
    event.preventDefault();
    if (!preferences.displayName.trim()) {
      setError("Enter a display name.");
      return;
    }
    try {
      savePreferences({
        ...preferences,
        displayName: preferences.displayName.trim(),
      });
      setSaved(true);
      setError("");
    } catch {
      setError(
        "Your browser could not save these preferences. Check your storage settings.",
      );
    }
  }
  return (
    <AppShell profile={data.profile} health={data.health}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAKE YOURSELF AT HOME</div>
          <h1>
            Settings<span className="heading-dot">.</span>
          </h1>
          <p>A few small preferences for your next meeting.</p>
        </div>
      </div>
      <Alert>{data.error}</Alert>
      <form className="settings-card" onSubmit={submit}>
        <div className="settings-profile">
          <div className="avatar large">
            {initials(data.profile?.display_name)}
          </div>
          <div>
            <h2>{data.profile?.display_name || "Demo User"}</h2>
            <p className="muted">{data.profile?.email || "Demo account"}</p>
            <span className="demo-badge">DEMO PROFILE</span>
          </div>
        </div>
        <div className="settings-section">
          <h3>
            <UserRound size={18} />
            Meeting identity
          </h3>
          <label htmlFor="display-name">Default display name</label>
          <input
            id="display-name"
            required
            maxLength={80}
            value={preferences.displayName}
            onChange={(e) => update("displayName", e.target.value)}
          />
          <p className="small muted">
            Your guests see this name. The demo account profile is read-only.
          </p>
        </div>
        <div className="settings-section">
          <h3>Joining preferences</h3>
          <label className="preference-row">
            <span>
              <Mic size={18} />
              Join with microphone on
            </span>
            <input
              type="checkbox"
              checked={preferences.audioEnabled}
              onChange={(e) => update("audioEnabled", e.target.checked)}
            />
          </label>
          <label className="preference-row">
            <span>
              <Video size={18} />
              Join with camera on
            </span>
            <input
              type="checkbox"
              checked={preferences.videoEnabled}
              onChange={(e) => update("videoEnabled", e.target.checked)}
            />
          </label>
          <p className="small muted">
            You can change these again before joining. Preferences are saved on
            this browser.
          </p>
        </div>
        <Alert>{error}</Alert>
        <Alert success>{saved ? "Preferences saved." : ""}</Alert>
        <div className="settings-footer">
          <button className="button primary">Save preferences</button>
        </div>
      </form>
    </AppShell>
  );
}
