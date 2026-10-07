# Backend API contract

Base URL: `http://127.0.0.1:8000`. Interactive documentation: `/docs`.
The planned frontend runs at `http://localhost:3000`.

## Endpoint overview

| Method and path | Input / credential | Success |
| --- | --- | --- |
| GET /health | None | Database status and whether media settings are present |
| GET /users/me | None | Default demo user's profile |
| POST /meetings/instant | Title/description; `{}` also works | 201 with meeting and creator host token |
| POST /meetings/scheduled | Title, description, ISO start, integer duration | 201 with meeting and creator host token |
| GET /meetings/upcoming | None | Array of future scheduled meetings |
| GET /meetings/recent | None | Array of the latest 20 ended meetings |
| POST /meetings/lookup | `meeting_input`: ID or app invite URL | Public meeting |
| GET /meetings/{code} | Meeting ID | Public meeting and current status |
| POST /meetings/{code}/start | X-Host-Token | Live meeting |
| POST /meetings/{code}/end | X-Host-Token | Ended meeting after cleanup succeeds |
| POST /meetings/{code}/join | Display name; optional X-Host-Token | Participant credentials and LiveKit connection data |
| POST /meetings/{code}/connected | Participant ID + X-Participant-Token | Participant with joined_at recorded |
| POST /meetings/{code}/leave | Participant ID + X-Participant-Token | Participant with left_at recorded |

## Creation

Scheduled request:

```json
{
  "title": "Planning",
  "description": "Discuss next steps",
  "scheduled_start_at": "2030-01-10T14:30:00+05:30",
  "duration_minutes": 30
}
```

Use a future time when testing. The database and responses normalize it to UTC.
The actual response has this outer structure:

```json
{
  "meeting": {
    "id": "UUID",
    "meeting_code": "11-digit ID",
    "status": "scheduled",
    "invite_link": "http://localhost:3000/join/MEETING_ID"
  },
  "host_token": "random-secret-returned-only-at-creation"
}
```

The nested meeting also includes title, description, kind, host_user_id,
scheduled_start_at, duration_minutes, actual timestamps, created_at, and room_name.
This abbreviated example is for reading; `/docs` gives the full response schema.

Store `host_token` by meeting code in frontend `sessionStorage`. Include it in
`X-Host-Token` for that meeting's Start/End and for joining as its host. Invite
links must never contain this secret. Seeded demo records have the public token
documented in the backend README; created records do not.

## Lookup, waiting, and joining

Lookup input:

```json
{ "meeting_input": "http://localhost:3000/join/91000000001" }
```

The same endpoint accepts a numeric ID, including spaces/hyphens. Only this app's
configured frontend origin and `/join/{code}` or `/meeting/{code}` paths are accepted.

For scheduled status, show Waiting for host and poll GET `/meetings/{code}`
every 3-5 seconds. Stop polling on screen cleanup or when status changes.
Join is allowed only when live. The backend enforces this even if frontend code is bypassed.

Join input:

```json
{ "display_name": "Alex" }
```

Join response:

```json
{
  "participant": {
    "id": "UUID",
    "display_name": "Alex",
    "role": "guest",
    "joined_at": null,
    "left_at": null
  },
  "participant_token": "random-attendance-secret",
  "livekit_url": "wss://your-project.livekit.cloud",
  "livekit_token": "signed-room-JWT",
  "room_name": "meeting-UUID"
}
```

Connect the LiveKit client with `livekit_url` and `livekit_token`. Current
participant display comes from the LiveKit SDK, not stored attendance rows.

## Attendance reports

After successful connection, send:

```http
POST /meetings/{code}/connected
Content-Type: application/json
X-Participant-Token: attendance-secret
```

```json
{ "participant_id": "participant UUID returned by join" }
```

Use the same body/header for `/leave` when explicitly leaving. Repeating either
report preserves the first timestamp. Once left, request a fresh join session
to rejoin. Reports are client assertions; they do not prove media attendance.
An abrupt exit may never send Leave. Do not keep someone in the call because a
departure API request fails: disconnect and show an appropriate message.

Host End updates database state before room cleanup. If it returns 502, keep
the host secret and show Retry End to finish cleanup. GET may already say ended.
Switching tabs and transient host disconnects must not automatically End.

## Error shapes

Application errors use FastAPI's `detail` wrapper:

```json
{
  "detail": {
    "code": "WAITING_FOR_HOST",
    "message": "Waiting for the host to start this meeting"
  }
}
```

Pydantic validation errors use `detail` as an array, with each entry's `loc`,
`type`, and `msg`. The frontend should read these field errors separately.

| HTTP status | Relevant application codes |
| --- | --- |
| 401 | HOST_TOKEN_REQUIRED, PARTICIPANT_TOKEN_REQUIRED |
| 403 | HOST_ACCESS_DENIED, PARTICIPANT_ACCESS_DENIED |
| 404 | MEETING_NOT_FOUND, PARTICIPANT_NOT_FOUND |
| 409 | WAITING_FOR_HOST, PARTICIPANT_LEFT, MEETING_ENDED on restart |
| 410 | MEETING_ENDED on join |
| 422 | INVALID_MEETING_ID, INVALID_INVITE_LINK, or schema validation |
| 502 | MEDIA_CLEANUP_FAILED; retry End |
| 503 | MEDIA_NOT_CONFIGURED, MEETING_ID_UNAVAILABLE |
