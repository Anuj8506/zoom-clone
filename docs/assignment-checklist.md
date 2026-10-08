# Assignment compliance

Checked against Scaler_SDE_Fullstack_Assignment_-_Zoom_Clone.docx.pdf on
8 October 2026. Document instructions are requirements for the project; they do
not authorize publishing code, creating accounts, or purchasing hosting.

| Requirement | Implementation / evidence | Status |
| --- | --- | --- |
| Next.js SPA | App Router pages, client components, `Link` and router navigation | Implemented |
| Python backend | FastAPI routes and separate services | Implemented |
| SQLite, own schema | User, Meeting, Participant; foreign keys, unique ID, explicit UTC storage | Implemented |
| Zoom dashboard | Portal header, sidebar, profile/settings, three meeting actions | Implemented; visual match remains approximate |
| Upcoming meetings | Separate dashboard card, meeting list page, saved scheduled meetings | Implemented |
| Recent meetings | Dashboard Recent activity lists ended meetings; Recent tab on meeting list page | Implemented |
| Instant meeting | Backend creates live meeting, random unique 11-digit ID, invite, frontend redirects | Implemented |
| Meeting room navigation | Redirects to room route with pre-join name/device preview, then live room | Implemented |
| Join by ID or link | Lookup validates syntax, configured invite origin, existence, ended status | Implemented |
| Display name before joining | Pre-join input and backend validation | Implemented |
| Scheduled title / description | Schedule form, validated API payload, database columns | Implemented |
| Date/time and duration | Local date/time picker, timezone-aware ISO API value, duration selector | Implemented |
| Auto-generated schedule link | Returned at creation and displayed for copying | Implemented |
| Store in database | SQLite persistence and restart test | Implemented |
| Functional conferencing | Real LiveKit Cloud media smoke test with two isolated browsers passed | Implemented; real phone quality still needs device test |
| Participants | In-room participant list and microphone state | Implemented; mute-all/removal are optional and omitted |
| No login required | Seeded default user; no signup prerequisite | Implemented |
| Seed database | Idempotent startup inserts demo user, two scheduled and two completed sample meetings | Implemented |
| README setup, stack, assumptions | Root, backend, frontend READMEs and explanatory docs | Implemented |
| Modularity | Separate app routes, components, hooks, services, models, schemas, utilities | Implemented |
| Responsive layout (bonus) | Desktop/mobile workflow and landscape toolbar checks | Implemented; physical phones not fully verified |
| Login/signup (bonus) | Outside requested scope | Omitted intentionally |
| Mute all/remove (bonus) | Outside requested scope | Omitted intentionally |
| Public GitHub repository | Local Git history exists; no remote configured at audit time | Pending submission |
| Deployed application | Local services with temporary Cloudflare tunnel | Permanent deployment pending |
| Submit both links | Requires repository publication and permanent deployment | Pending submission |
| Understand every line | Explanatory docs prepared; requires the applicant's own review and practice | Cannot be certified by automated testing |
| Original work | Local source was developed for this task using frameworks/SDKs | No plagiarism certification claimed |

## Corrections during this audit

- Root README now describes the current portal layout rather than the retired
  clock card and four-action dashboard.
- Verification instructions include the real LiveKit Cloud media test.
- Submission documentation distinguishes the temporary tunnel from deployment.
- Required and bonus features are explicitly separated to prevent scope inflation.

## Important assumptions

Created meetings use a private host secret in tab-scoped session storage. Closing
the host tab can lose that capability; it does not automatically end a meeting.
Attendance is best effort, reported by the browser. Duration is planned length,
not a meeting auto-end timer. Sample meeting dates age after initial insertion;
newly scheduled future meetings appear in Upcoming. Invite links use the configured
FRONTEND_URL. Use one frontend origin consistently when hosting/joining a demo.

Existing verification: 17 backend tests, six frontend workflows, ESLint, production
build, and real Cloud generated-media smoke test passed. The development-only
ESLint dependency advisory remains documented in frontend/README.md.
