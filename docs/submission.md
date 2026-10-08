# Permanent submission setup

The assignment requires a public GitHub repository and a deployed app link.
Submit https://github.com/Anuj8506/zoom-clone and
https://zoom-clone-anuj8506.vercel.app. The temporary Cloudflare link is no longer
needed for submission.

## Repository

1. Create an empty public GitHub repository under the applicant's account.
2. Review the staged source and existing commit history before pushing.
3. Keep .env, .env.local, databases, .venv, node_modules, and generated reports
   excluded. Commit .env.example and dependency lockfiles.
4. Add the chosen repository URL as the Git remote and push the existing branch.
5. Confirm the repository opens while signed out; put final demo/setup links in README.

Public repository: https://github.com/Anuj8506/zoom-clone.

## Application

The selected targets are Vercel for Next.js and Render's free Python web service.
The user explicitly selected ephemeral SQLite and accepted account/meeting resets.
Startup restores seed records and the sole administrator using private environment
configuration. Use persistent storage for a production service. See deployment.md
for the checked-in Blueprint and exact hosting configuration.

Backend setup:

- Install backend/requirements.txt and start `uvicorn app.main:app` from backend.
- Bind the server to 0.0.0.0 and the hosting provider's assigned port.
- For the selected free demo, use `sqlite:///./data/zoom_clone.db`.
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
that seed records and the administrator return after an empty-database reset.
User-created data can be lost in the selected free setup. The final link must work with the
applicant's laptop switched off. Submit that link and the public repository link.

Both hosting services are deployed. Provider choice and free-tier data resets
are agreed. Keep the service credentials in private hosting configuration.
