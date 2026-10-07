# Sharing a temporary demo

Your friend's `localhost` points to their own device. A copied localhost invite
cannot reach your computer. Browsers also require HTTPS (or their own localhost)
to use cameras and microphones. Plain HTTP on your laptop's Wi-Fi IP address is
therefore insufficient for a normal audio/video call.

The app supports one frontend entry point: `/api/backend/*` forwards requests
through Next.js to the Python server. The LiveKit media connection goes directly
to your configured secure LiveKit Cloud WebSocket URL.

For a temporary friend demo, a Cloudflare Quick Tunnel can supply an HTTPS link
to the frontend. It does not need a Cloudflare account or a domain. Starting it
makes the demo publicly reachable while it runs, so do that only when intended.

Before using a tunnel:

1. Start the backend on 127.0.0.1:8000 and restart the frontend after configuration
   changes.
2. Use `NEXT_PUBLIC_API_URL=/api/backend` (the default) and
   `BACKEND_URL=http://127.0.0.1:8000` in the frontend. Remove any old frontend
   environment override that makes the browser call 127.0.0.1 directly.
3. Start a Quick Tunnel to `http://localhost:3000`.
4. Set backend `FRONTEND_URL` to the resulting HTTPS origin so invite links and
   lookup validation match it. Include that origin in `CORS_ORIGINS` if also
   making direct browser-to-backend requests. Preserve all LiveKit credentials.
5. For Next.js development mode, set `ALLOWED_DEV_ORIGIN` in frontend
   `.env.local` to the tunnel hostname (without `https://`) and restart the
   frontend. Restart the backend, open the HTTPS link yourself, and create a new meeting.
   Host tokens are scoped to the browser origin: a token saved on localhost is
   not automatically available on the tunnel origin.
6. Send that meeting's HTTPS invite to your friend. Keep both servers and the
   tunnel running. Stopping the tunnel ends access through that link.

Quick Tunnel URLs change on restart. Restore `FRONTEND_URL=http://localhost:3000`
when returning to local-only use. An internet connection is needed by both users.
This is a temporary test setup; permanent submission hosting is a separate step.

References: [browser media requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
and [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
