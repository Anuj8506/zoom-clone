# Vercel frontend and Render backend

- App: https://zoom-clone-anuj8506.vercel.app
- Backend: https://zoom-clone-api-t4xq.onrender.com
- Public source: https://github.com/Anuj8506/zoom-clone

Both services are connected to the repository's `main` branch. Vercel deploys
only `frontend`; Render deploys `backend` from the root Blueprint.
No local tunnel is required for these URLs.

This project uses the free Render demo setup. SQLite stays on Render's ephemeral
filesystem: accounts and meetings can disappear when the service sleeps, restarts
or redeploys. Startup restores sample records and the configured sole admin.
Use a paid persistent disk or managed database if the data must survive.

## Render

Create a Blueprint from the public repository using the root `render.yaml`, or
create a free Python web service with root directory `backend`:

- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check: `/health`
- Python: `3.13.9`

Set the private environment variables listed in the Blueprint. `AUTH_SECRET`
must remain stable across deployments. The LiveKit secret belongs only on Render.
Set `ADMIN_USER_ID=2` and the administrator's email, display name and existing
salted scrypt hash in `ADMIN_PASSWORD_HASH`. Never upload the local SQLite file.
Bootstrap rejects collisions and preserves an existing account's password.

## Vercel

Import the same GitHub repository, select Next.js, and set root directory to
`frontend`. Keep the normal Next.js build/output defaults. Set:

- `BACKEND_URL`: the Render service's HTTPS origin, with no trailing slash.
- `NEXT_PUBLIC_API_URL`: `/api/backend`.

Then deploy. `BACKEND_URL` is read during the build, so changing it requires a
new deployment. The browser sends API requests to Vercel; Next.js forwards them
to Render. Browser clients never receive the LiveKit API secret or auth secret.

Finally set Render `FRONTEND_URL` and `CORS_ORIGINS` to the final Vercel HTTPS
origin. This makes generated invitations point to the deployed app.

The current values are both `https://zoom-clone-anuj8506.vercel.app`.
Vercel's `BACKEND_URL` is `https://zoom-clone-api-t4xq.onrender.com`.

## Release checks

Check backend `/health`, open the frontend, sign in as the configured admin,
exercise Guest mode, schedule/start/join/end a meeting, and test a two-browser
LiveKit call including screen sharing and host moderation. Never describe a
deployment as verified until these checks have passed on its real URLs.

Free Render services can sleep and require a cold start. Open the demo before
showing it to an evaluator; Vercel hosting does not remove this backend delay.
