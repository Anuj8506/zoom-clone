const HOST_PREFIX = "zoom-clone:host:";
const PREFERENCES_KEY = "zoom-clone:preferences";
const DEMO_CODES = new Set([
  "91000000001",
  "91000000002",
  "91000000003",
  "91000000004",
]);

export function saveHostToken(code, token) {
  // If storage is blocked, don't pretend the host can safely leave this screen.
  window.sessionStorage.setItem(`${HOST_PREFIX}${code}`, token);
}

export function getHostToken(code) {
  try {
    return (
      window.sessionStorage.getItem(`${HOST_PREFIX}${code}`) ||
      (DEMO_CODES.has(code) ? "demo-meetings-host-token" : null)
    );
  } catch {
    return null;
  }
}

export function loadPreferences() {
  const defaults = {
    displayName: "Demo User",
    audioEnabled: true,
    videoEnabled: false,
  };
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(PREFERENCES_KEY) || "{}",
    );
    if (!saved || typeof saved !== "object" || Array.isArray(saved))
      return defaults;
    return {
      displayName:
        typeof saved.displayName === "string" && saved.displayName.trim()
          ? saved.displayName.trim().slice(0, 80)
          : defaults.displayName,
      audioEnabled:
        typeof saved.audioEnabled === "boolean"
          ? saved.audioEnabled
          : defaults.audioEnabled,
      videoEnabled:
        typeof saved.videoEnabled === "boolean"
          ? saved.videoEnabled
          : defaults.videoEnabled,
    };
  } catch {
    return defaults;
  }
}

export function savePreferences(value) {
  window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(value));
}
