# QuantumMeet Client

React SPA for **QuantumMeet** — P2P video meetings with a socket-shaped realtime adapter over REST polling (Mongo event bus on the API). Media is WebRTC.

## Features

- WebRTC peer-to-peer video
- Picture-in-Picture (Document PiP API)
- Responsive layouts
- Chat, Q&A, polls, transcription, whiteboard, breakouts
- SecretMeet random 1-on-1 matching
- Classroom flows (HTTP + Vercel Blob uploads)

## Built With

- React 18 + React Router v6
- `src/lib/realtimeClient.js` — REST event poll + presence (socket-shaped API)
- `@vercel/blob/client` (classroom uploads)
- CSS Modules

## Local setup

```bash
npm install
cp .env.example .env
```

| Variable | Purpose |
|---|---|
| `REACT_APP_SERVER_URL` | API base URL (default `http://localhost:5000`) |
| `REACT_APP_ICE_SERVERS` | Optional JSON STUN/TURN array |

```bash
npm start
```

App: `http://localhost:3000`

## Vercel deploy

- Project root: `client/`
- Build: `npm run build` or `vercel-build`
- Config: `vercel.json` SPA rewrite → `/index.html` (React Router deep links)
- Set `REACT_APP_SERVER_URL` to your API project URL (no trailing slash)

---

<p align="center">Designed and crafted for QuantumMeet</p>
