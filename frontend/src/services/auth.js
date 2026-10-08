const KEY = "zoom-clone:account";
const GUEST_KEY = "zoom-clone:guest";

export function guestMode() {
  try {
    return window.sessionStorage.getItem(GUEST_KEY) === "true";
  } catch {
    return false;
  }
}

export function enterGuestMode() {
  window.sessionStorage.removeItem(KEY);
  window.sessionStorage.setItem(GUEST_KEY, "true");
  clearHostAccess();
}

export function accountToken() {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function clearHostAccess() {
  for (const key of Object.keys(window.sessionStorage)) {
    if (key.startsWith("zoom-clone:host:"))
      window.sessionStorage.removeItem(key);
  }
}

export function signIn(token) {
  window.sessionStorage.setItem(KEY, token);
  window.sessionStorage.removeItem(GUEST_KEY);
  clearHostAccess();
}

export function signOut() {
  window.sessionStorage.removeItem(KEY);
  window.sessionStorage.removeItem(GUEST_KEY);
  clearHostAccess();
}
