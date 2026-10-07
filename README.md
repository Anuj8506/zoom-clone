# Zoom Clone

A small Scaler assignment project using **Next.js, FastAPI, SQLite, and LiveKit**.
The backend is implemented first. The Next.js frontend will be added in the next step.

## Current scope

- Instant meetings with unique 11-digit IDs and frontend invite links.
- Scheduled meetings with title, description, timezone-aware start time, and duration.
- Upcoming and recent meeting lists, a default demo user, and repeatable sample data.
- Meeting lookup by ID or this application's invite link.
- Host-only Start/End actions and a Waiting for host response.
- LiveKit access-token generation, participant connection/leave reports, and room cleanup.
- Separate configuration, database models, validation schemas, routes, and services.
- Focused tests, setup instructions, and explanations of unfamiliar technologies.

The dashboard, camera preview, call UI, and client-side waiting screen belong to the
future frontend. Backend invite URLs are generated for that future frontend.

## Open and run in VS Code

Open **D:\Zoom Clone** with File > Open Folder. Select
`backend\.venv\Scripts\python.exe` as the Python interpreter.

The virtual environment and dependencies have already been created on this computer.
Run the backend in a VS Code PowerShell terminal:

```powershell
Set-Location 'D:\Zoom Clone\backend'
& '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Visit:

- API documentation: <http://127.0.0.1:8000/docs>
- Health: <http://127.0.0.1:8000/health>

To run the tests:

```powershell
Set-Location 'D:\Zoom Clone\backend'
& '.\.venv\Scripts\python.exe' -m pytest
```

## Read next

- [Backend setup and API examples](backend/README.md)
- [Detailed explanation of the new technologies](docs/backend-explained.md)
- [Frontend API contract for the next step](docs/api-contract.md)

## Project organization

```text
Zoom Clone/
  backend/
    app/
      config.py            environment configuration
      database.py          SQLite engine and request sessions
      main.py              compose the FastAPI application
      dependencies.py      provide settings/media service to handlers
      seed_data.py         default user and sample meetings
      models/              actual SQLAlchemy database tables
      schemas/             Pydantic request/response shapes
      routes/              HTTP handlers
      services/            meeting, participant, and media logic
      utils/               UTC storage, secret hashing, and API errors
    tests/                 API workflow and media integration checks
    seed.py                optional explicit seeding command
    .env.example           settings template
    requirements.txt       runtime dependencies
    requirements-dev.txt   test dependencies
  docs/
  .gitignore
  README.md
```

## Assumptions

The application has one demo owner, not real account authentication. Each newly
created meeting has its own random host secret; knowing user ID 1 or typing a
host role does not authorize meeting management. Guest joining requires a display
name. Planned duration is descriptive and does not automatically end a call.

Authentication, mute-all/remove controls, webhooks, automatic host-disconnect
cleanup, and complex infrastructure are deferred. GitHub publication and deployment
are later steps, after the local project is reviewed.
