# Bonus features and interview explanation

New visitors open `/signin` before accessing the dashboard. Existing users sign
in; new users sign up, see an account-created confirmation, and then sign in.
Continue as Guest opens the required no-login demo. Each account has its own
upcoming/recent meetings. Anyone with an invitation can still join directly as
a guest. Settings provides Sign Out, which returns to Sign In.

The small EntryGate component holds back dashboard pages until a browser has an
account session or has explicitly chosen guest mode. The guest choice is stored
in sessionStorage for that tab and survives refresh; signing in clears it and
signing out clears both states. This is the entry flow, not server authorization.
FastAPI still validates JWT signatures and enforces host/admin permissions on
every protected API request. Invite and meeting routes remain accessible so
invited guests are not forced to register.

## Passwords and sessions — new backend concepts

A password is never stored directly. Signup generates a random salt and derives
a hash using Python's hashlib.scrypt. Login repeats that derivation with the
saved salt and compares the results with hmac.compare_digest. A salt gives two
people with the same password different database hashes. Scrypt deliberately
uses memory and CPU, making guessing stored hashes more expensive.

PyJWT creates a signed token containing the user's ID, issue time, expiration,
issuer and audience. The server verifies the signature and these claims before
loading the user. A signature prevents modifying an ID without detection; it
does not encrypt the token. No password or API secret is placed in it.

The token is stored in sessionStorage and sent in the Authorization header.
Sessions expire after eight hours. Sign Out clears this browser's token and host
capabilities. It does not revoke a stolen token on the server. This basic assignment
implementation has no password reset, email verification, or distributed rate limit.

AUTH_SECRET is a random backend-only environment value. Keep it persistent.
For account meetings, an HMAC derived from that secret, owner ID and meeting code
provides a separate host capability. SQLite stores its SHA-256 hash. The owner
can retrieve it through /host-access after signing back in; other users receive
403. Demo-created meetings keep the original random, tab-scoped host capability.
Changing AUTH_SECRET invalidates sessions and account host capabilities.

## LiveKit host controls — new SDK methods

The browser never gets room-admin permission or the LiveKit API secret. Clicking
Mute All calls our FastAPI endpoint with the host capability. FastAPI verifies
the host, requests LiveKit's participant list and mutes active guest microphone
tracks. It skips host tracks, cameras and screen-share audio. Guests may unmute
themselves; there is no forced remote unmute.

For a particular guest, Mute looks up that participant and mutes only their
microphone track. Ask to Unmute writes a unique request ID into that participant's
server-controlled LiveKit metadata. The guest browser receives the metadata
event and shows Unmute / Stay muted. Accepting calls setMicrophoneEnabled(true)
on the guest's own client; declining leaves it off. Each request gets a new ID,
so a host may ask again after a decline. Guests cannot write their own metadata
with the issued media grants, and cannot call host endpoints without the host
capability. Guests retain their own microphone controls.

These meeting controls use the existing SQLite meeting and participant records.
No new database, database table, or schema migration is required. The meeting
creator is its host; these are meeting permissions, not a global administrator role.

## Sole site administrator

The site owner account is provisioned locally with `backend/set_admin.py`.
It creates or updates a normal SQLite account with a salted password hash, then
sets `ADMIN_USER_ID` and `ADMIN_EMAIL` in the ignored backend `.env`. Both must
match the authenticated account; the shared demo account cannot be administrator.
Only one ID/email pair can be configured. No additional database or schema change
is needed. There is no public endpoint for granting administrator status.

The `/admin` page lists up to 100 meetings/accounts per page and supports ending
any meeting with confirmation. FastAPI checks the administrator on every admin
request; hiding the navigation link alone is not authorization. End first marks
the meeting ended in SQLite, then uses the same graceful LiveKit cleanup as host
End. Retry End if remote cleanup fails. Other accounts retain their own calendars
and meeting host controls. Joining as a guest remains available.

Administrator access does not edit source code or deploy changes. App functionality
is still changed in the project files and tested. This basic panel has no account
deletion, role delegation, permanent bans, or runtime feature editor.

To replace a temporary password locally, run from the backend folder:
`.\.venv\Scripts\python.exe set_admin.py your-email@example.com`. The script prompts without
echoing the password and stores only its hash. Restart the backend afterward.
Existing account JWTs expire normally; changing a password does not revoke them.

Remove first shows a confirmation. The API verifies that the selected participant
belongs to this meeting and is not a host. It asks LiveKit Cloud to disconnect
and revoke the participant's current token, then records left_at. The guest sees
a removal message. This is session removal, not a permanent ban: a fresh join
request is allowed while the meeting is live.

The React components show state and call our API; FastAPI owns permission rules;
LiveKit carries media and applies moderation. These responsibilities are separate
and remain in modular files rather than one large component.

## Appearance and scope

The supplied Zoom portal screenshots guide the navy utility bar, white header,
pale sidebar, blue/orange action tiles, rounded cards and dark footer. The room
keeps the dark stage and bottom toolbar. Responsive layouts adapt the same flows
for phones. Unimplemented Zoom products and paid-plan advertisements are omitted.
The supplied images cover a portal dashboard, not every Zoom screen, so a full
pixel-perfect reproduction across all screens is not claimed.

## Verification

Run backend pytest, frontend ESLint, Playwright workflows and a production build.
The optional test:media script uses real LiveKit Cloud with generated camera,
microphone and canvas tracks in two isolated browser contexts. It verifies screen
share reception at a phone viewport, individual mute, unmute request decline and
acceptance, guest-only permissions, Mute All, guest unmute, Remove, fresh rejoin
and End. This checks browser behavior, not physical mobile hardware quality.
Set `TEST_ADMIN_EMAIL` and `TEST_ADMIN_PASSWORD` only in the test process environment
to also check the configured real account and ending another host's Cloud call.
Tests never print account or media tokens. LiveKit may refresh cached region data
for 30 seconds after disconnect; a 401 is expected for a revoked token. The media
test accepts only that exact endpoint with a known revoked participant identity;
all other console/HTTP errors still fail.
