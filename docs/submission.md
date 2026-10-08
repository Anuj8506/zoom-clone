# Permanent submission setup

The assignment requires a public GitHub repository and a deployed app link.
The current temporary Cloudflare link forwards to a laptop and can disappear.
It should not be presented as a completed permanent deployment.

## Repository

1. Create an empty public GitHub repository under the applicant's account.
2. Review the staged source and existing commit history before pushing.
3. Keep .env, .env.local, databases, .venv, node_modules, and generated reports
   excluded. Commit .env.example and dependency lockfiles.
4. Add the chosen repository URL as the Git remote and push the existing branch.
5. Confirm the repository opens while signed out; put final demo/setup links in README.

No repository was created or published as part of this audit.

## Application

Choose hosting that can run Next.js and a persistent Python service. These can
be separate services. Keep the SQLite database on a persistent writable disk.
Do not rely on an ephemeral service filesystem for submitted meeting data.

Backend setup:

- Install backend/requirements.txt and start `uvicorn app.main:app` from backend.
- Bind the server to 0.0.0.0 and the hosting provider's assigned port.
- Set DATABASE_URL to the database file on the persistent disk.
- Set FRONTEND_URL to the final HTTPS frontend origin.
- Set CORS_ORIGINS to that origin if the browser calls the backend directly.
- Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET as backend-only secrets.
- Set a strong persistent AUTH_SECRET; keep it stable to preserve account host access.
- Keep SEED_DATABASE=true for the initial demonstration database.

Frontend setup:

- Install from frontend/package-lock.json using npm ci and build with npm run build.
- For the existing same-origin proxy, use NEXT_PUBLIC_API_URL=/api/backend and
  BACKEND_URL equal to the deployed backend's reachable base URL.
- Set these environment values before building; rebuild when proxy destinations change.
- Run the production server on the provider's interface/port, or use a platform
  that deploys Next.js directly. Do not expose a development server for submission.
- ALLOWED_DEV_ORIGIN is for a local development tunnel and is not required in production.

## Final evaluator check

Open the final HTTPS link in a fresh browser. Confirm default profile, new meeting,
ID/link joining, scheduling, Upcoming, Recent, guest waiting, media connection,
and host End. Test with a friend on another device. Restart the backend and verify
that saved meetings survive. The final link must continue working with the
applicant's laptop switched off. Submit that link and the public repository link.

Account access, provider choice, and any paid persistent-storage plan must be
settled before publication. No hosting account or deployment was created here.
