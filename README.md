# Mobiler

Mobiler connects customers who need physical cash (withdrawals) or want to
deposit cash into mobile money (Airtel Money / MTN MoMo) with nearby verified
agents who fulfil the request in person. Built around Kampala, Uganda.

## How it works

1. A **customer** requests a withdrawal or deposit at their current location.
2. The matching engine finds the nearest **online, verified agent** within
   range who can cover the amount on the requested network, and offers them
   the job in real time (Socket.io).
3. The agent has a limited window to accept; unaccepted offers expire and
   the engine retries with the next-nearest agent.
4. Agent and customer confirm details by phone, the agent gets **turn-by-turn
   directions** to the customer, and marks the job complete once cash has
   changed hands.

## Features

- **Role-based accounts**: customer, agent, admin
- **Phone-verified signup**: OTP sent by SMS (Twilio) before an account can
  log in
- **Forgot password**: reset via a code sent to the phone on file
- **Agent KYC**: agents upload a national ID, trader license, mobile money
  license, and a face scan; an admin reviews and approves/rejects before the
  agent can go online
- **Geo-based matching**: nearest eligible agent within their service radius
  and network float, with automatic retry/expiry
- **Real-time updates** via Socket.io (offers, status changes)
- **Get directions** deep link from the agent's job view straight to the
  customer's location

## Stack

- **Client**: React 19 + Vite, react-router
- **Server**: Express 5, Prisma + PostgreSQL, Socket.io, JWT auth
- **SMS**: Twilio (OTP delivery)
- **Deployment**: Docker Compose (server + Postgres + client via nginx) or
  client-only on Vercel with the server hosted elsewhere

## Project layout

```
client/    React + Vite frontend
server/    Express API, Prisma schema/migrations, Socket.io
docker-compose.yml       local dev: Postgres only
docker-compose.prod.yml  full stack: Postgres + server + client
```

## Local development

Requires Node 22+ and Docker (for Postgres).

```bash
# 1. Start Postgres
docker compose up -d

# 2. Server
cd server
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, etc.
npm install
npx prisma migrate dev
npm run seed            # optional demo data, see below
npm run dev              # http://localhost:4000

# 3. Client (separate terminal)
cd client
cp .env.example .env    # point at the server above
npm install
npm run dev              # http://localhost:5173
```

### Demo accounts (after `npm run seed`)

All use password `password123`:

- `admin1@example.com` — admin
- `agent1@example.com`, `agent2@example.com`, `agent3@example.com` — pre-verified agents
- `customer1@example.com` — customer

### OTP in development

Without Twilio credentials configured, OTP codes aren't delivered by SMS —
set `ENABLE_DEV_OTP=true` in `server/.env` to have codes echoed back in the
API response (and shown directly in the UI) so the flow is testable without
a real phone. Never enable this in a deployment reachable by real users.

## Deployment

### Server + Postgres (Docker Compose)

```bash
cp .env.example .env.prod   # fill in real values
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Runs Postgres, the API (migrations applied automatically on boot), and the
client behind nginx. See `.env.example` for every variable it needs,
including Twilio credentials for OTP delivery.

### Client on Vercel

The client can be hosted separately on Vercel:

1. Import this repo, set **Root Directory** to `client`
2. Add `VITE_API_URL` / `VITE_SOCKET_URL` pointing at your hosted server
3. Deploy — `client/vercel.json` handles SPA routing

## Environment variables

See `.env.example` (root, for Docker Compose), `server/.env.example`, and
`client/.env.example` for the full list with descriptions.
