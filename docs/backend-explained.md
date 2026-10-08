# Backend explained using what you already know

You know Python, JavaScript, Express, REST APIs, SQL/MySQL, WebSockets, JWT,
and Git. This guide focuses on the unfamiliar libraries and project decisions.

## 1. Familiar parts: overview

This is the same HTTP flow as an Express application:

```text
request -> route -> validation -> service -> database -> JSON response
```

Routes handle HTTP input/output. Services implement meeting rules. Models map
to database tables. Git tracks source changes. Environment variables configure
origins, storage, and third-party credentials.

We deliberately keep those responsibilities in separate files. Start reading
at `backend/app/main.py`, then follow one route into its service and model.

## 2. FastAPI: the Python equivalent of your route-handler layer

**Read:** `app/main.py`, `app/routes/meetings.py`, `app/dependencies.py`.

An Express route looks roughly like `router.post('/instant', handler)`. In FastAPI,
the decorator `@router.post('/instant')` registers the function immediately below it.
`APIRouter(prefix='/meetings')` adds a shared path prefix. `app.include_router(...)`
mounts the router, similar to Express `app.use(...)`.

Function arguments tell FastAPI what input to obtain:

- `code: str` takes the `{code}` path segment.
- `payload: InstantMeetingCreate` takes JSON and validates it against that schema.
- `x_host_token: str | None = Header(default=None)` reads `X-Host-Token`.
- `db: Session = Depends(get_db)` calls `get_db` to supply a database session.

### What does Depends mean?

`Depends` is dependency injection: a handler asks for a resource, and a provider
creates or retrieves it. It keeps the handler from constructing a connection
or reading configuration every time.

`get_db` uses `yield`, so its `with` block stays open while the handler runs and
closes afterward. Every request gets its own session. `get_settings` and
`get_media` read the configured instances from `request.app.state`.

Dependency injection supplies resources. Optional account authentication now uses
the get_current_user dependency; see bonus-features.md for its separate explanation.
Actual host authorization still happens in `require_host`.

### What happens at startup?

FastAPI's `lifespan` block in `main.py` runs setup before accepting requests:
create the engine, register a session factory, create missing tables, and seed
the demo data. Code after its `yield` disposes the engine when the server stops.

Ordinary `def` handlers run through FastAPI's worker-thread mechanism. End uses
`async def` because it awaits an external LiveKit HTTP request. `await` lets the
event loop handle other work while that network request is waiting. It does not
turn synchronous SQLite queries into asynchronous queries.

### Response models and interactive documentation

`response_model=MeetingResponse` declares the JSON output contract. It also
prevents private model columns from being accidentally returned. FastAPI uses
the types to generate an OpenAPI schema and the `/docs` interface.

## 3. Pydantic: input validation and output shapes

**Read:** `app/schemas/meeting.py` and `app/schemas/participant.py`.

A Pydantic model is a Python class describing data, not a database table.
For example, `ScheduledMeetingCreate` requires a title, timezone-aware start,
and a positive integer duration. FastAPI builds this model before the route
function executes.

`Field(min_length=1, max_length=120)` describes a valid title. The config trims
string whitespace, so a title containing only spaces becomes empty and fails.
`extra='forbid'` rejects fields the API has not declared, such as a guest sending
`role='host'`. `strict=True` on duration rejects a string such as `'30'`.

`AwareDatetime` rejects timezone-less timestamps. Our extra validators require
an ISO string, normalize its offset to UTC, and require a future start time.
Validation failures return HTTP 422 with field-specific error information.

### Why separate models and schemas?

The database meeting stores `host_capability_hash`. A public response should not
contain it. The input needs a title and scheduling values, not a database ID or
creation timestamp. Separate classes let each layer expose only what it needs:

```text
ScheduledMeetingCreate -> Meeting row -> MeetingResponse
```

`ConfigDict(from_attributes=True)` lets a response schema read an ORM object's
attributes. `public_meeting` then adds the invite link using the frontend origin.

## 4. SQLAlchemy: mapping Python objects to the SQL you know

**Read:** `app/database.py`, `app/models/`, and `app/services/meeting_service.py`.

SQLAlchemy is an ORM: a model class represents a table, and an instance represents
a row. `Base` holds the metadata describing registered tables. Importing the
model modules registers the `users`, `meetings`, and `participants` definitions.

- `Mapped[str]` says an ORM attribute has string values.
- `mapped_column(String(11), unique=True)` specifies a SQL column and its constraint.
- `ForeignKey('users.id')` is a real database foreign key.
- `relationship(...)` provides Python-level navigation between related objects;
  it does not replace the foreign-key column.

One user hosts many meetings. One meeting has many participant sessions. A guest's
`user_id` is empty, because guests have no registered account. Each guest still
has a display name and its own participant-session identity.

### Engine versus session

The engine manages connections to SQLite. A session tracks objects, queries,
and pending changes for one request.

- `db.add(meeting)` tracks a new row.
- `db.flush()` sends pending SQL without completing the transaction.
- `db.commit()` makes the transaction durable.
- `db.rollback()` discards the current transaction after an error.
- `select(Meeting).where(...)` builds a parameterized SQL query.

We use `expire_on_commit=False` so an object just saved can still be serialized
without automatically reloading every attribute. Sessions are not shared among
requests. `check_same_thread=False` permits SQLite connections to be used with
FastAPI's thread-based request handling; it does not make one shared session safe.

### Why use a unique database constraint?

Two requests could randomly pick the same meeting code. A pre-check alone would
still race. The unique constraint makes the database reject the collision. We
roll back and retry with a new code, with a maximum of five attempts.

### create_all versus migrations

`Base.metadata.create_all(engine)` creates missing tables. It does not add or
rename columns in existing tables. This is enough for a fixed assignment schema.
For a growing application, migrations such as Alembic would manage schema changes.

## 5. SQLite and timezone handling

**Read:** `app/utils/time.py`, `app/config.py`, and `app/seed_data.py`.

You can use familiar SQL tables, indexes, constraints, and relationships. SQLite
keeps the database in a local file rather than a separate MySQL server. We enable
foreign-key enforcement on every connection.

Relative database paths resolve from the backend folder, so opening VS Code or
running a command from another directory does not silently create a different DB.
Deployment must keep this file on persistent storage and use one backend instance.

### Why UTCDateTime exists

SQLite does not preserve timezone metadata in SQLAlchemy's normal DateTime
storage. Our small `TypeDecorator` converts a timezone-aware value to UTC before
storing it and attaches UTC when reading it back. That keeps comparisons and JSON
responses consistent.

For example, `2030-01-10T14:30:00+05:30` represents the same instant as
`2030-01-10T09:00:00Z`. The frontend converts UTC to the viewer's local time.
Naive strings such as `2030-01-10T14:30:00` are rejected because their timezone is unknown.

### Repeatable seed data

Sample meetings have stable codes/IDs. Startup inserts them only if absent and
preserves existing records. Sample dates are relative to their first insertion,
not shifted on every restart. Seeding is not a backup: if a host discards the DB,
it can restore the samples but not previously created user meetings.

## 6. LiveKit: backend permissions for media transport

**Read:** `app/services/media_service.py` and the participant join route.

WebSocket experience helps with events, but live audio/video introduces media
tracks and connectivity concerns. LiveKit handles signaling, media transport,
connectivity/TURN support, and room presence. Our backend decides whether a user
can enter a particular application meeting.

The browser will capture camera/microphone tracks and connect using LiveKit's
client SDK. Video does not flow through our REST API and is not stored in SQLite.

### Token generation

The Python server SDK signs a JWT with the project's API secret. The token contains:

- `sub`: this participant session's unique identity.
- `name`: its display name.
- `video.room`: the one allowed room.
- Join, publish, and subscribe permissions, but no browser room-admin permission.
- An expiration time for initial connection, set to five minutes.

Token generation signs data locally; it does not contact LiveKit to prove credentials
are correct. The frontend's real connection is that integration check. Token expiry
does not automatically disconnect a participant already connected to LiveKit.

Host room administration uses the server SDK and private project credentials,
not a browser admin JWT. The join metadata includes the verified host/guest role
for future UI display.

### Why three different tokens?

| Credential | Purpose | Who receives it? |
| --- | --- | --- |
| Host capability secret | Start/End this application meeting | Creator, returned once when created |
| Participant-session secret | Report this session's Connected/Leave events | That joining participant |
| LiveKit JWT | Join a particular media room with limited permissions | That joining participant |

Host and participant secrets are random opaque values; their hashes are stored
in SQLite. They are not JWTs. SHA-256 is appropriate here because the generated
secrets have high random entropy; human passwords would need password hashing
such as Argon2. Comparison uses `compare_digest` rather than an ordinary string equality.

The frontend keeps host secrets in sessionStorage keyed by meeting code, never
in invite URLs. Losing that browser session loses host access in this simplified
login-free version. Only seeded samples use a deliberately public demo secret.

## 7. Waiting, attendance, and ending

Scheduled meetings reject join-token requests with `WAITING_FOR_HOST`. The future
frontend reads their status and polls every few seconds. Host Start changes the
status to live; the guest can then join. Backend checks remain authoritative
even if someone bypasses the UI.

Receiving a join token does not mean media connected. `/join` creates a pending
participant. After the SDK reports successful connection, `/connected` records
the first join timestamp. Explicit Leave records the first departure timestamp.
Repeated reports do not overwrite those times.

These are best-effort client reports. A crashed tab may never send Leave, and
we do not use them as authoritative LiveKit presence or billing data. Webhooks
and automatic host cleanup are intentionally deferred.

End marks the application meeting ended before calling LiveKit, so new API join
requests stop immediately. The server revokes participant tokens on LiveKit Cloud
and deletes the room. If remote cleanup fails, End returns 502 and the host retries
the same operation. The end timestamp is preserved. This explicit retry is simpler
than adding a background job or distributed transaction.

## 8. How to read the code in one focused walkthrough

1. Read `main.py` and identify startup, CORS, and the mounted routers.
2. Trace POST `/meetings/instant` through its schema, route, service, model, and response.
3. Follow scheduling validation and explain the UTC conversion.
4. Trace guest waiting and host Start. Verify why a user-supplied role cannot grant host access.
5. Follow Join: pending participant, three credentials, JWT grant, and response.
6. Follow Connected/Leave and End, including their repeat-safe behavior and failure limits.
7. Run pytest and inspect `/docs`. Try creating your own meeting rather than only reading code.

## Primary references

- [FastAPI dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/)
- [FastAPI lifespan](https://fastapi.tiangolo.com/advanced/events/)
- [Pydantic validation](https://docs.pydantic.dev/latest/concepts/validators/)
- [SQLAlchemy sessions](https://docs.sqlalchemy.org/en/20/orm/session_basics.html)
- [SQLAlchemy table creation](https://docs.sqlalchemy.org/en/20/core/metadata.html)
- [LiveKit tokens](https://docs.livekit.io/frontends/reference/tokens-grants/)
- [LiveKit participant administration](https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/)
- [Render persistent storage](https://render.com/docs/disks)
