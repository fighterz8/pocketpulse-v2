# PocketPulse

Small-business cashflow analysis web application (Phase 1: auth and account setup).

## Stack

TypeScript, Node.js, Express, React, Vite, Wouter, TanStack Query, PostgreSQL, Drizzle ORM, express-session, connect-pg-simple, bcrypt, Vitest.

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `SESSION_SECRET`, and `APP_ORIGIN`.
2. `npm install`
3. `npm run db:push` — requires a `drizzle.config.ts` and schema (added in later Phase 1 tasks).

## Scripts

| Script    | Description                                      |
| --------- | ------------------------------------------------ |
| `npm run dev` | Development: Express on `PORT` (default `5000`) with Vite dev middleware — API and SPA on one server (Replit/Cursor preview) |
| `npm run dev:vite` | Optional split setup: standalone Vite on port 5000; `/api` proxies to `http://localhost:5001` by default (override with `API_PORT`) — run `PORT=5001 tsx server/index.ts` in another terminal |
| `npm run build` | Production client bundle → `dist/public`; compiled server → `dist/server` |
| `npm run start` | Production: compiled Express from `dist/server/index.js` serves `/api` + static SPA (`dist/public`) |
| `npm run check` | Typecheck with `tsc --noEmit`                    |
| `npm test`    | Run Vitest                                       |
| `npm run db:push` | Push Drizzle schema (after config exists)    |

### Production `npm start`

After `npm run build`, `npm start` runs Express with the API and the Vite production bundle from `dist/public` on one server. Default listen port is `5000` (`PORT`).

## Ports

- **Default development** (`npm run dev`): one process on `PORT` (default `5000`); same-origin `/api` and Vite HMR.
- **Optional split** (`dev:vite` + `tsx server/index.ts`): Vite on `5000` (`vite.config.ts`); run the server with `PORT=5001` (or set `API_PORT` in the Vite proxy target to match).
- **Production**: `PORT` (default `5000`).

## Local development

**Default (one terminal):** `npm run dev` — open `http://localhost:5000`. No separate API process.

**Optional split** (e.g. debugging Vite in isolation): in one terminal, `PORT=5001 tsx server/index.ts`; in another, `npm run dev:vite`. Open `http://localhost:5000` for HMR; `/api` is proxied to the server on `5001`.
