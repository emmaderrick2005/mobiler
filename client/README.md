# Mobiler — client

React + Vite frontend for Mobiler. See the [root README](../README.md) for
the full project overview, architecture, and deployment instructions.

## Development

```bash
cp .env.example .env   # set VITE_API_URL / VITE_SOCKET_URL
npm install
npm run dev             # http://localhost:5173
```

## Scripts

- `npm run dev` — Vite dev server with HMR
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the production build locally
- `npm run lint` — Oxlint

## Environment variables

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the Mobiler API, e.g. `http://localhost:4000/api` |
| `VITE_SOCKET_URL` | Base URL for the Socket.io connection, e.g. `http://localhost:4000` |

Both are inlined into the build at build time — changing them requires a
rebuild, not just a redeploy of static files.

## Deployment

Deployable as a static site (see `Dockerfile` + `nginx.conf` for the Docker
Compose path, or `vercel.json` for Vercel). Either way, `VITE_API_URL` and
`VITE_SOCKET_URL` must point at a running Mobiler server — see the root
README for hosting that.
