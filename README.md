# Zoom Clone

A small Scaler assignment project using Next.js, plain JavaScript, FastAPI,
SQLite, and LiveKit. Both the frontend and backend are implemented locally.
Open **D:\Zoom Clone** in VS Code to inspect the separate folders.

## Run locally

Dependencies are already installed on this computer. Start these in two separate
VS Code PowerShell terminals. If the app is already running, use the existing
instance instead of starting a second copy on the same port.

**Terminal 1 — backend:**

```powershell
Set-Location 'D:\Zoom Clone\backend'
& '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — frontend:**

```powershell
Set-Location 'D:\Zoom Clone\frontend'
npm.cmd run dev
```

Open <http://localhost:3000>. Backend API documentation: <http://127.0.0.1:8000/docs>.
Stop a server running in your terminal with Ctrl+C.

## Implemented features

- Zoom web-portal Home with header, pale sidebar, profile/settings, and New Meeting,
  Join, and Schedule actions. Upcoming meetings and recent activity are separate sections.
- New Meeting generates a unique ID, redirects to a meeting lobby, and provides an invite.
- Join accepts an ID or app invite link, validates it, and asks for a display name.
- Schedule saves title, description, future date/time, and duration in SQLite.
- Upcoming and Recent lists, search, seed data, and a default demo profile.
- Waiting for the host, host Start/End, camera preview, and a dark meeting room.
- SDK integration for real audio/video, microphone/camera toggles, screen sharing,
  participant list, invites, and Leave/End controls.
- Browser preferences for display name and initial microphone/camera state.
- Error handling, responsive screens, modular files, and focused verification.
- Optional sign-up/sign-in with personal meeting lists, salted password hashing,
  eight-hour account sessions, and recovery of host access after signing back in.
- Host-only Mute, Ask to Unmute, Mute All and Remove controls in the Participants panel.
- A sole site administrator can view account/meeting records and end any meeting from `/admin`; other users keep their own meeting host controls.
- New visitors see Sign In first, with Sign Up and Continue as Guest options. Signup asks the user to sign in before opening their dashboard; invitations still allow direct guest joining.

**Live video/audio requires your own LiveKit Cloud credentials.** The UI and
meeting management work without them; joining a call then shows an honest
unavailable message. No fake participants or simulated calls are included in
normal application flows.

Copy `backend/.env.example` to `backend/.env` and fill in `LIVEKIT_URL`,
`LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`. Restart the backend. Never put the
API secret in a frontend variable or commit `.env`.
Set a persistent random `AUTH_SECRET` in backend/.env for account sessions and
account host recovery. This computer already has one configured. Keep it private
and stable; changing it invalidates sessions and account meeting capabilities.

## Verification

```powershell
Set-Location 'D:\Zoom Clone\backend'
& '.\.venv\Scripts\python.exe' -m pytest

Set-Location 'D:\Zoom Clone\frontend'
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

Browser tests use Microsoft Edge and isolated API/frontend servers on ports
8001/3001, with a separate SQLite test database. They cover real local API
workflows. The room rendering test supplies a test-only media token/socket; it
cannot verify LiveKit Cloud connectivity. See the frontend README for a real
call checklist once credentials are configured. `npm.cmd run test:media` runs
the optional real LiveKit Cloud smoke test with generated camera/audio/screen
tracks; keep the normal servers running and provide valid backend media settings.
It creates and ends a test meeting and consumes Cloud quota.

## Folder structure

```text
Zoom Clone/
  backend/
    app/
      config.py, database.py, main.py, dependencies.py, seed_data.py
      models/       database tables
      schemas/      validated input/output shapes
      routes/       HTTP handlers
      services/     meeting, participant, and media logic
      utils/        UTC storage, secret hashing, and errors
    tests/
    seed.py
    .env.example
    requirements.txt, requirements-dev.txt, requirements.lock.txt
    README.md
  frontend/
    public/         local SVG assets
    src/
      app/          Next.js routes and CSS entry point
      components/
        dashboard/  Home, meeting lists, and preferences
        forms/      Join and Schedule dialogs
        layout/     sidebar, header, and page shell
        meeting/    lobby, preview, session, and room controls
        ui/         reusable controls
      hooks/        dashboard data loading
      services/     API client and browser storage
      styles/       base, dashboard, portal, forms, meeting, and responsive CSS
      utils/        formatting, clipboard, and browser media capability helpers
    scripts/        optional real LiveKit Cloud smoke test
    tests/          browser workflow tests
    .env.example
    package.json, package-lock.json
    README.md
  docs/
    api-contract.md
    backend-explained.md
    frontend-explained.md
  .gitignore
  README.md
```

The src/app folder provides Next.js file-based routing. Interactive pages use
client components and client-side navigation for the assignment's SPA experience.
The Python server remains responsible for business rules and data.

## Deliberate limits

Demo access remains available without signing in. Optional accounts have their
own upcoming/recent lists. Sessions are kept in this tab's sessionStorage; signing
out clears the browser session and cached host secrets. Demo-created meetings use
random host secrets, and account-created meetings use a server-derived host secret
that only the authenticated owner can retrieve. SQLite stores only its hash.
Guests never receive those secrets in invites. Four seed records use a demo token.
Closing a host tab does not automatically end the meeting; attendance is best
effort on abrupt exits. Duration is planned length, not an automatic timer.

Recordings, persistent chat, webhooks, and automatic host-disconnect cleanup
remain out of scope. Mute All mutes guest microphones; guests can unmute themselves.
Remove disconnects the selected guest and revokes their current media token;
it is not a permanent ban, and the invitation can be used to rejoin.
Account authentication is basic: no password reset, email verification, distributed
rate limiting, or server-side logout revocation. Use HTTPS for public access.
Phone browsers without screen-capture support can view a desktop share but cannot
present their own screen. The UI closely follows the supplied Zoom portal references;
it is not a pixel-for-pixel reproduction of every Zoom product or promotional section.
SQLite needs persistent storage when deployed. GitHub publication and permanent
deployment remain pending; the temporary Cloudflare tunnel forwards to this laptop.

## Read later

- [Backend setup and API examples](backend/README.md)
- [Frontend setup and real video-call checklist](frontend/README.md)
- [Backend technologies explained](docs/backend-explained.md)
- [Frontend technologies explained](docs/frontend-explained.md)
- [API contract](docs/api-contract.md)
- [Assignment compliance checklist](docs/assignment-checklist.md)
- [Permanent submission setup](docs/submission.md)
- [Bonus features explained](docs/bonus-features.md)
