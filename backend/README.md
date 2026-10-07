# Backend

## Stack

Python 3.12, FastAPI, Uvicorn, Pydantic, SQLAlchemy, SQLite, and the LiveKit Python
server SDK. Tests use FastAPI TestClient and pytest. Dependencies are pinned to
the versions installed for this implementation.

## Start using the existing environment

```powershell
Set-Location 'D:\Zoom Clone\backend'
& '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

You can create and schedule meetings without configuring LiveKit. Open
<http://127.0.0.1:8000/docs> to execute the API requests interactively.

`app.main:app` means: import the variable named `app` from `app/main.py`.
`--reload` restarts the development server when Python source changes.
Stop a foreground server with Ctrl+C.

## Recreate the environment on another computer

Install Python 3.12 and use either standard Python tooling or uv:

```powershell
Set-Location 'D:\Zoom Clone\backend'
py -3.12 -m venv .venv
& '.\.venv\Scripts\python.exe' -m pip install -r requirements-dev.txt
```

If you use uv:

```powershell
uv venv --python 3.12 .venv
uv pip install --python '.\.venv\Scripts\python.exe' -r requirements-dev.txt
```

`requirements.lock.txt` records the complete installed dependency set; it is
available when you need to reproduce this exact environment. Do not commit or
copy `.venv`; create it again on the other machine.

## Configuration

Defaults are enough for local meeting CRUD. For a real call, create a LiveKit
Cloud project, copy the example configuration, and fill in its credentials:

```powershell
Copy-Item -LiteralPath '.env.example' -Destination '.env'
```

```dotenv
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-project-api-key
LIVEKIT_API_SECRET=your-project-api-secret
```

Restart the server after editing `.env`. `GET /health` reports whether the three
settings are present; it does not check that those credentials work remotely.
The API secret stays on the Python server. `.env` is ignored by Git.

The frontend's base URL defaults to `http://localhost:3000`. Invite links have
the form `http://localhost:3000/join/{meeting_code}`. The frontend does not exist
yet, but `/meetings/lookup` can validate those generated links.

## Database and sample records

The default database is `backend/data/zoom_clone.db`, independent of the terminal's
current folder. Tables are created at startup using `create_all()`. This is not
a migration tool and will not alter existing columns after a model change.

Startup always ensures that demo user ID 1 exists. With `SEED_DATABASE=true`, it
also inserts two upcoming and two completed sample meetings with attendance.
Existing records are preserved. Sample dates are generated only when first inserted,
so they age naturally; restarting does not shift them into the future.

Explicit seeding is also available:

```powershell
& '.\.venv\Scripts\python.exe' seed.py
```

Seeded meeting IDs are `91000000001` through `91000000004`. Their intentionally
public demo host token is `demo-meetings-host-token`, allowing these demonstration
records to be started/ended from Swagger. Newly created meetings use private,
random host tokens; they never use this demo token.

## Try the main workflow in PowerShell

Keep the server running in another terminal:

```powershell
$apiBase = 'http://127.0.0.1:8000'

# 1. Create an instant meeting.
$createdMeeting = Invoke-RestMethod -Method Post -Uri "$apiBase/meetings/instant" `
    -ContentType 'application/json' -Body '{"title":"Interview Demo"}'
$meetingCode = $createdMeeting.meeting.meeting_code
$hostHeaders = @{ 'X-Host-Token' = $createdMeeting.host_token }

# 2. Validate the invite. This also accepts the numeric meeting ID.
$lookupBody = @{ meeting_input = $createdMeeting.meeting.invite_link } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$apiBase/meetings/lookup" `
    -ContentType 'application/json' -Body $lookupBody

# 3. End it with the creator's host capability.
Invoke-RestMethod -Method Post -Uri "$apiBase/meetings/$meetingCode/end" -Headers $hostHeaders

# 4. Verify that it is now in recent meetings.
Invoke-RestMethod -Uri "$apiBase/meetings/recent"
```

Scheduling example:

```powershell
$scheduleBody = @{
    title = 'Project Planning'
    description = 'Discuss the next steps'
    scheduled_start_at = [DateTimeOffset]::Now.AddHours(2).ToString('o')
    duration_minutes = 30
} | ConvertTo-Json
$scheduledMeeting = Invoke-RestMethod -Method Post -Uri "$apiBase/meetings/scheduled" `
    -ContentType 'application/json' -Body $scheduleBody
$scheduledCode = $scheduledMeeting.meeting.meeting_code
$scheduledHostHeaders = @{ 'X-Host-Token' = $scheduledMeeting.host_token }
Invoke-RestMethod -Method Post -Uri "$apiBase/meetings/$scheduledCode/start" -Headers $scheduledHostHeaders
```

Without LiveKit settings, a live meeting's `/join` request returns HTTP 503 with
`MEDIA_NOT_CONFIGURED`. A scheduled meeting returns HTTP 409 `WAITING_FOR_HOST`
before checking media configuration. An ended meeting returns HTTP 410.

## State, permissions, and validation

- Instant creation produces a live meeting. Scheduled creation produces a scheduled meeting.
- Host-only Start changes scheduled to live. Starting a live meeting again preserves its start time.
- Host-only End changes it to ended. It cannot be started again.
- Names and titles are trimmed and cannot be blank. Description is optional.
- Scheduling requires a future ISO timestamp with an offset or `Z` and an integer duration of 1-1440 minutes.
- Meeting codes are unique 11-digit strings. The database constraint protects against collisions.
- Hosts send `X-Host-Token`; connection/leave reports send `X-Participant-Token`.
- Host and participant secrets are SHA-256 hashed in SQLite and omitted from public responses.
- The join token lasts five minutes for initial connection. Browsers never receive LiveKit room-admin permission.

## End Meeting and LiveKit cleanup

End saves the ended state first so new API join requests immediately stop. It then
revokes issued participant tokens using LiveKit Cloud participant removal and deletes
the media room. An already absent participant/room is treated as successful cleanup.

If the remote service fails, End returns HTTP 502 `MEDIA_CLEANUP_FAILED`. The
database remains ended. Retry the same End request with the host token: cleanup
is attempted again without overwriting the end timestamp. Database updates and
an external API call cannot form one shared database transaction.

The token-revocation behavior is for LiveKit Cloud. A self-hosted LiveKit server can
have different revocation behavior and is outside this assignment setup.

## Tests

```powershell
& '.\.venv\Scripts\python.exe' -m pytest
```

Tests cover seed/restart persistence, ID collision retry, ID/link lookup, scheduling
validation and UTC conversion, host/guest permissions, waiting and ended states,
CORS, signed LiveKit JWT claims, attendance retries, and remote cleanup retry behavior.
They use isolated temporary databases and test-only signing keys. External LiveKit
calls are mocked; real media connectivity needs your Cloud credentials and the frontend.

## Deployment later

Use one backend service with a persistent SQLite disk/volume. For Render, the
service root is `backend`; build with `pip install -r requirements.txt`, then run:

```sh
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Mount persistent storage at `/var/data` and set:

```dotenv
DATABASE_URL=sqlite:////var/data/zoom_clone.db
FRONTEND_URL=https://your-frontend-domain.example
CORS_ORIGINS=https://your-frontend-domain.example
```

Set real LiveKit environment variables on the backend service. Render's free
filesystem is ephemeral: startup seeding restores samples, not user-created meetings.
Paid persistent storage or another host's persistent volume is needed for reliable data.

## Deliberate limitations

- One default demo owner; no login/signup or per-account isolation.
- Attendance is best-effort reporting, not verified server-side media attendance.
- Abrupt browser exits may leave `left_at` empty and a meeting marked live.
- A host who loses the browser session's host secret cannot recover management access.
- Existing short-lived tokens require remote revocation on End; remote failures require retry.
- Planned duration does not auto-end calls. Auto-cleanup jobs, webhooks, mute-all,
  remove controls, and production-scale infrastructure are deferred.
