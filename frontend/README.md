# Frontend

## Run

Start the Python backend on port 8000, then:

```powershell
Set-Location 'D:\Zoom Clone\frontend'
npm.cmd run dev
```

Open **http://localhost:3000**. Use localhost consistently so copied invite URLs
and tab-scoped host credentials have the same origin. The backend also permits
127.0.0.1:3000, but its default invite origin is localhost:3000.

For a fresh checkout, install Node.js 20.9+ (this machine has Node 24), then
run `npm.cmd ci` from this folder. `package-lock.json` pins installed dependencies.

## Environment variables

Local defaults work without creating a frontend environment file.

```dotenv
NEXT_PUBLIC_API_URL=/api/backend
BACKEND_URL=http://127.0.0.1:8000
```

To change it, copy `.env.example` to `.env.local`, edit, and restart Next.js.
NEXT_PUBLIC variables are browser-visible and embedded during production build.
By default, browser requests use `/api/backend` on the frontend origin. Next.js
forwards them to the Python `BACKEND_URL`, so another device does not try to reach
its own localhost. `BACKEND_URL` is server-only. A direct public API URL remains
optional if deploying the two services separately.
Set these URLs before building/deploying. LiveKit secrets belong only in the
Python backend. Next.js telemetry can be disabled using `NEXT_TELEMETRY_DISABLED=1`.

## Screens

| Route | Purpose |
| --- | --- |
| `/` | Zoom web-portal dashboard, profile, three meeting actions, Upcoming/Recent |
| `/meetings` | Meeting lists and title/ID/description search |
| `/settings` | Read-only demo profile and editable local preferences |
| `/join/{code}` | Guest invite, waiting state, name/device choices |
| `/meeting/{code}` | Same lobby with host actions when the host secret is available |

The server still validates host rights. Changing URLs or browser UI does not
grant access. A new meeting returns its host secret once; we store it separately
from the invite in sessionStorage. Losing that tab session loses host access.

After joining, click Share Screen in the
toolbar to trigger the browser's screen-picker from your own click.

## Real audio/video checklist

1. Put valid LiveKit Cloud URL, API key, and API secret in `backend/.env`; restart
   Python. Health's configured flag only checks presence, not validity.
2. Start a New Meeting and enable microphone/camera as desired in the lobby.
3. Join, copy the invite, and open it in another browser or incognito session.
   This also ensures the guest does not inherit the host tab's sessionStorage.
4. Join with a different display name. Verify both participants can see/hear each
   other, then test mute, camera toggling, Participants, and screen sharing.
5. Guest Leave should disconnect that guest. Host End > End meeting for all should
   close the room for both users. Confirm Recent shows the completed meeting.
6. Schedule a future meeting; open its invite as a guest before host Start to
   verify the waiting screen. The guest polls the API every five seconds.

Localhost and HTTPS support camera/microphone access; plain HTTP on a remote
host does not. Two devices are preferable for audio checks to avoid feedback.
Screen/audio sharing support varies by browser and selected screen type.

Attendance is reported after actual SDK connection and on Leave. An abrupt
browser close can miss the leave request. Host End failures show a retry action
because database End and remote room cleanup are separate operations. A host's
normal Leave keeps the meeting live for guests.

## Checks

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

Browser tests use installed Microsoft Edge. On another machine, install Edge
or change `channel: "msedge"` in `playwright.config.mjs` to your installed browser.
Alternatively remove channel and run `npx.cmd playwright install chromium`.
Tests start both servers on 3001/8001 and use fresh ignored SQLite files under
backend/data. No actual user meetings or credentials are used.

They cover instant meetings, invite lookup, scheduling, independent guests,
waiting/start/end, preference persistence, search, unavailable media, mobile
overflow, and unreachable-backend errors. A separate test checks room controls
using a test-only media grant/socket. This does not prove real networked media.

Screenshots and failure traces go in ignored `test-results/`.

For an optional real LiveKit Cloud smoke test, keep the normal backend/frontend
running with valid LiveKit settings and run `npm run test:media`. Edge must be
installed. This creates and ends a test meeting and uses Cloud quota. Two isolated
browsers publish generated camera/audio and screen-share tracks; no real camera
or screen is captured. It verifies reception, phone-sized viewing, Stop Share,
and host End. Set `TEST_APP_URL` to test another frontend origin if needed.
This does not replace testing real phone browsers, audible quality, or poor Wi-Fi.

Dependency audit note (2026-10-08): production npm packages and installed Python
packages had no known advisory findings. The full npm audit reported five linked
high-severity entries from the development-only ESLint chain ending in `braces`.
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
has no published patch. No major downgrade or forced audit fix was applied.

## Design and scope

Screen sharing depends on the browser's `getDisplayMedia` capability. Phone
browsers that do not provide it can receive a desktop screen share but cannot
present their own screen. The existing Share Screen button explains this instead
of reporting a generic camera/device error. A native mobile app is outside scope.
See [browser support](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia#browser_compatibility).

LiveKit adaptive streaming and dynacast are enabled to reduce unnecessary video
bandwidth. Status polling skips overlapping requests, and refreshing dashboard
lists keeps existing meetings visible. The meeting toolbar fits short landscape
viewports and respects mobile safe areas.

The dashboard follows the supplied Zoom web-portal screenshots: navy utility
strip, white header, pale sidebar, profile card, orange New Meeting, blue action
tiles, upcoming meetings on the right, recent activity on the left, and a dark
footer. The call screen retains its dark background and bottom toolbar.
While presenting, the shared screen stays large and camera tiles remain in a
separate strip (right side on desktop, bottom on mobile). MeetingStage keeps
camera and screen layouts separate and uses stable participant keys, avoiding
the SDK GridLayout stale-array error during placeholder/video transitions.
`ProfileCard`, `ActionTiles`, `MeetingList`, and `PortalFooter` keep the UI modular.
`styles/portal.css` scopes the portal styling without changing meeting-room styles.
Product advertisements, billing, downloads, and unrelated products are omitted.
CSS tokens define shared colors. SVG assets are local and handmade;
Lucide supplies consistent icons. There are no remote fonts or UI framework.

The media SDK supplies track subscriptions, device toggles, and browser media
transport. Our components supply page flows, state, room chrome, invites, and
host End behavior. Optional Sign In / Sign Up provides account calendars;
Settings provides Sign Out. Hosts can use Mute All and Remove from Participants.
The backend verifies those permissions before calling LiveKit. No recordings or
extra productivity features are added. See ../docs/bonus-features.md for details.

Deployment later: set frontend's public API URL, backend FRONTEND_URL and
CORS_ORIGINS to the real domains, configure Cloud keys, and preserve SQLite with
a volume/disk. Deploy both services, not only the Next.js frontend.
