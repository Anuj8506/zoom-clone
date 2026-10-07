# Frontend: unfamiliar parts explained

Read this later. React state, forms, CSS, fetch, and JavaScript remain the parts
you already know. The new parts are Next.js routing and the LiveKit client.

## 1. Next.js is the React project framework

In a Vite app you usually have `main.jsx`, `App.jsx`, and React Router routes.
Next.js supplies the entry point and routes through the `src/app` folder.
`src/app/page.jsx` is Home; `src/app/settings/page.jsx` is `/settings`.
`src/app/join/[code]/page.jsx` has a dynamic URL segment: the actual meeting ID
becomes `code`. Its thin wrapper passes that value into our reusable lobby.

`layout.jsx` wraps every route with the HTML/body, global CSS, metadata, and icon.
It replaces the HTML/entry scaffolding you would manually configure in Vite.
Our JavaScript is plain `.js` and `.jsx`; the build tool's internal TypeScript
phase does not mean this project uses TypeScript.

### Client components

Next.js can render components on the server. Browser features such as camera
access, sessionStorage, click handlers, and React state need client components.
The `"use client"` line marks the boundary that includes those components in the
browser's JavaScript bundle. Our dashboard, dialogs, and lobby are interactive
client components. A small server route wrapper passes the meeting code to them.

Client components may still get initial HTML rendered on the server. That is why
we read browser storage and local time inside `useEffect`, after mounting.
Doing it directly in server rendering could access an absent `window` or produce
different server/client HTML. Browser-only media code is dynamically imported
with `ssr: false` from the client lobby.

### Client navigation and the SPA requirement

`Link` and `useRouter().push()` move between Next.js routes without a full browser
page reload. State changes and API responses update the displayed screen. The
application behaves like an SPA while Next.js manages route files and bundles.
FastAPI handles the backend; we do not duplicate database logic in Next.js.

The alias `@/` points to `src/` through `jsconfig.json`. It simply avoids long
relative paths such as `../../../services/api`.

## 2. LiveKit client: what happens when you join

1. The user enters a display name and chooses initial mic/camera settings.
2. Our API client calls the Python `/join` endpoint, sending the host secret only
   when this tab has it. Python determines the participant role.
3. Python returns a room-scoped, short-lived JWT, a server URL, and participant
   attendance credentials. Its signing secret never reaches the browser.
4. `LiveKitRoom` connects to that URL with the JWT. The SDK handles signaling,
   WebRTC media transport, subscriptions, and reconnection.
5. On its successful connection event, our code reports `/connected` so the API
   records `joined_at`. Merely requesting a join token is not counted as attendance.
6. On Leave, we disconnect media first, then report `/leave`. An API failure
   cannot trap somebody in the call.

### Components inside the room

`LiveKitRoom` provides React context: its child controls can find the same room
without passing a room object through every component.

`useTracks()` subscribes to camera and screen-share track state. `GridLayout`
and `ParticipantTile` display those tracks, including camera-off placeholders.
`RoomAudioRenderer` plays remote audio. `StartAudio` supplies a click if browser
autoplay rules prevent sound from starting automatically.

`TrackToggle` manages microphone, camera, or screen-share publishing. We use its
real enabled state for the icons and labels rather than a pretend local flag.
Screen sharing requires an explicit click so the browser can show its picker.
When a screen is shared, our stage focuses on screen-share tracks.

`useParticipants()` supplies the live participant list, and `useLocalParticipant()`
supplies local mic/camera/share state. The room UI uses these SDK hooks; the database
attendance table is not a reliable source for currently connected people.

### Host End differs from Leave

Leave disconnects just this participant. A host may choose to leave guests in
the room. End calls the Python host-authorized endpoint, which marks the meeting
ended and asks LiveKit Cloud to revoke tokens/remove participants/delete the room.
If remote cleanup fails, the meeting remains ended in SQLite and the UI offers
Retry End. We retain the host secret for that retry.

Polling catches host End even if a guest's media connection missed an event.
Scheduled guests also poll until the host starts. Cleanup clears those intervals.
An abrupt host tab close does not automatically End; this is a documented limit.

## 3. Browser storage: two different lifetimes

`sessionStorage` holds a new meeting's host token, keyed by meeting ID. It survives
a reload in the same tab but generally ends with that tab session. It is a random
capability, not a user login. The backend checks its stored hash.

`localStorage` holds non-secret preferences: display name and initial mic/camera
choices. They persist across normal tab closures. Guest URLs contain only the
meeting ID, never the host secret. The four demo IDs deliberately use a public
seed token, matching the backend's sample records.

## 4. Time conversion and API errors

The date/time input represents the browser's local time. `new Date(input)` creates
that local instant, and `.toISOString()` sends its UTC equivalent with `Z`. UTC
is an explicit timezone too; the backend validates and stores the instant in UTC.
Formatting responses with `toLocaleDateString/TimeString` shows local time again.

`services/api.js` centralizes the API base URL, JSON fetch options, timeout,
credential headers, and backend error parsing. Components use that shared helper
instead of duplicating authentication-header logic. Components decide which user
message and loading state to show. Requests normally use `/api/backend` on the
frontend origin; `next.config.mjs` forwards them to the separate Python server.
This keeps API requests reachable when the frontend is opened from another device
or an HTTPS demo link. `BACKEND_URL` configures that forwarding destination.

## 5. Verification boundaries

The production build checks compilation and routes. ESLint catches code and React
hook mistakes. Browser tests exercise the real Python API with isolated data.
One test mounts the SDK room with a test-only grant/socket to catch runtime
rendering mistakes; it does not test media transport. Real two-person audio/video
must be checked against your LiveKit Cloud project after configuring credentials.

## Reading order when you return

1. `frontend/src/app/page.jsx` → `components/dashboard/Dashboard.jsx`
2. `components/forms/ScheduleDialog.jsx` → `services/api.js`
3. `components/meeting/MeetingLobby.jsx`
4. `components/meeting/MeetingSession.jsx` → `MeetingRoom.jsx`
5. `services/storage.js`, then `styles/` (imported by `app/globals.css`)

Official references: [Next.js App Router](https://nextjs.org/docs/app),
[client components](https://nextjs.org/docs/app/getting-started/server-and-client-components),
[LiveKitRoom](https://docs.livekit.io/reference/components/react/component/livekitroom/),
[tracks](https://docs.livekit.io/reference/components/react/hook/usetracks/), and
[TrackToggle](https://docs.livekit.io/reference/components/react/component/tracktoggle/).
