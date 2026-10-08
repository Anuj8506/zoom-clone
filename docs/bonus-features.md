# Bonus features and interview explanation

The required no-login demo remains available. Optional sign-up/sign-in lives at
/signin; Settings provides Sign Out. Each account has its own upcoming/recent
meetings. Anyone with a meeting invitation can still join as a guest.

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
share reception at a phone viewport, Mute All, guest unmute, Remove, fresh rejoin
and End. This checks browser behavior, not physical mobile hardware quality.
