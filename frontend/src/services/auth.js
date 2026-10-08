const KEY = "zoom-clone:account";

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
  clearHostAccess();
}

export function signOut() {
  window.sessionStorage.removeItem(KEY);
  clearHostAccess();
}
