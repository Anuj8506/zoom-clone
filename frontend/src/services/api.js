import { accountToken } from "./auth";

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "/api/backend"
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export async function request(
  path,
  { method = "GET", body, headers = {}, keepalive = false } = {},
) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(accountToken()
          ? { Authorization: `Bearer ${accountToken()}` }
          : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      keepalive,
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    throw new ApiError(
      error.name === "TimeoutError"
        ? "The server took too long to respond. Please try again."
        : "Cannot reach the meeting server. Please check that the backend is running.",
      "NETWORK_ERROR",
      0,
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail
          .map(
            (field) =>
              `${field.loc?.slice(1).join(".") || "Input"}: ${field.msg}`,
          )
          .join(". ")
      : detail?.message ||
        (typeof detail === "string"
          ? detail
          : "The request could not be completed.");
    throw new ApiError(
      message,
      detail?.code || "REQUEST_FAILED",
      response.status,
    );
  }
  return data;
}

const hostHeaders = (token) => (token ? { "X-Host-Token": token } : {});
const participantHeaders = (session) => ({
  "X-Participant-Token": session.participant_token,
});
export const api = {
  hostAccess: (code) =>
    request(`/meetings/${encodeURIComponent(code)}/host-access`, {
      method: "POST",
    }),
  login: (body) => request("/auth/login", { method: "POST", body }),
  signup: (body) => request("/auth/signup", { method: "POST", body }),
  muteAll: (code, token) =>
    request(`/meetings/${encodeURIComponent(code)}/mute-all`, {
      method: "POST",
      headers: hostHeaders(token),
    }),
  removeParticipant: (code, identity, token) =>
    request(
      `/meetings/${encodeURIComponent(code)}/participants/${encodeURIComponent(identity)}/remove`,
      { method: "POST", headers: hostHeaders(token) },
    ),
  health: () => request("/health"),
  profile: () => request("/users/me"),
  upcoming: () => request("/meetings/upcoming"),
  recent: () => request("/meetings/recent"),
  instant: () => request("/meetings/instant", { method: "POST", body: {} }),
  schedule: (body) => request("/meetings/scheduled", { method: "POST", body }),
  lookup: (input) =>
    request("/meetings/lookup", {
      method: "POST",
      body: { meeting_input: input },
    }),
  meeting: (code) => request(`/meetings/${encodeURIComponent(code)}`),
  start: (code, token) =>
    request(`/meetings/${encodeURIComponent(code)}/start`, {
      method: "POST",
      headers: hostHeaders(token),
    }),
  end: (code, token) =>
    request(`/meetings/${encodeURIComponent(code)}/end`, {
      method: "POST",
      headers: hostHeaders(token),
    }),
  join: (code, name, token) =>
    request(`/meetings/${encodeURIComponent(code)}/join`, {
      method: "POST",
      body: { display_name: name },
      headers: hostHeaders(token),
    }),
  connected: (code, session) =>
    request(`/meetings/${encodeURIComponent(code)}/connected`, {
      method: "POST",
      body: { participant_id: session.participant.id },
      headers: participantHeaders(session),
    }),
  leave: (code, session, keepalive = false) =>
    request(`/meetings/${encodeURIComponent(code)}/leave`, {
      method: "POST",
      body: { participant_id: session.participant.id },
      headers: participantHeaders(session),
      keepalive,
    }),
};
