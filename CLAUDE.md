# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Tab It is a Splitwise-alternative for splitting expenses. It's a pnpm + Turborepo monorepo requiring Node >=24.

## Commands

### Development
```bash
pnpm install                          # Install all dependencies
pnpm run build --filter=models --filter=db  # Build shared packages first (required before dev)
pnpm dev                              # Run all apps concurrently (web, pwa, api, notifications)
pnpm dev:pwa                          # Run only the PWA
pnpm dev:web                          # Run only the landing page
```

### Database
```bash
cd packages/db && pnpm db:push        # Push schema changes (dev, no migration files)
cd packages/db && pnpm db:generate    # Generate migration files
cd packages/db && pnpm db:migrate     # Run migrations
cd packages/db && pnpm db:studio      # Open Drizzle Studio
```

### Type checking & linting
```bash
pnpm check                            # TypeScript check across all packages
pnpm lint                             # ESLint across all packages
# Per-package: cd apps/pwa && pnpm check
```

### Production
```bash
pnpm start:prod                       # Runs db:migrate:prod then starts all services
```

## Architecture

### Monorepo Structure
- `apps/web` — Next.js 15 landing page (port 3000), uses App Router
- `apps/pwa` — Vite + React SPA, the main expense-splitting app (port 3003)
- `apps/api` — Hono REST API (port 3001), the backend for all data operations
- `apps/notifications` — WebSocket server (port 3002), uses Redis pub/sub + web-push
- `apps/mcp` — MCP server exposing tab/friend tools
- `packages/db` — Drizzle ORM schema, client, migrations (PostgreSQL)
- `packages/models` — Shared Zod schemas and TypeScript types
- `packages/auth` — Better Auth configuration (magic link / email OTP only, emails via Plunk)
- `packages/shared` — Shared utilities (e.g. `createId`)
- `packages/data` — Data access layer (query functions used by both `api` and `web`)

### Key Architectural Patterns

**API proxy in PWA dev**: The PWA (Vite) proxies `/api-backend` → `http://localhost:3001` and `/api/auth` → `http://localhost:3001`. In production, this must be configured at the reverse proxy level. All API calls in `apps/pwa/lib/api-client.ts` go through `/api-backend`.

**Auth**: Better Auth handles sessions. The `packages/auth` package exports a configured `auth` instance used by both the API (at `/api/auth/*`) and server-side in `apps/web`. The PWA uses `better-auth/react` via `apps/pwa/lib/auth-client.ts`.

**Database**: Drizzle ORM with PostgreSQL. Schema is split into `schema/auth.ts` (Better Auth managed tables) and `schema/app.ts` (application tables: tabs, expenses, settlements, friends, etc.). The `packages/data` package contains query logic organized into `tab`, `expense`, `settlement`, and `activity` namespaces.

**PWA data flow**: TanStack Query for server state with IndexedDB (`idb-keyval`) persistence. Zustand for client UI state (`lib/stores/ui-store.ts`, `lib/stores/nav-store.ts`). Query keys are defined in `lib/query-keys.ts`.

**PWA routing**: React Router DOM v7. Route definitions are in `src/routes/app-layout-routes.tsx`. Page components live in `app/(app)/` following a Next.js-style directory convention (but it's React Router, not Next.js App Router).

**Alias**: `@` maps to the root of `apps/pwa` (i.e., `apps/pwa/`), so `@/app/...` refers to `apps/pwa/app/...` and `@/lib/...` to `apps/pwa/lib/...`.

**AI feature**: The API has an `/ai/add-expense` endpoint using Google AI SDK (`@ai-sdk/google`) for natural language expense entry.

**Real-time**: The `apps/notifications` server bridges Redis pub/sub messages (published by the API after mutations) to WebSocket clients and sends web push notifications via `web-push`.

### Environment Variables
All apps read from a root `.env` / `.env.local` file (via `dotenv-cli`). Key variables:
- `DATABASE_URL` — PostgreSQL connection string
- `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` — Auth config
- `PLUNK_SECRET_KEY` — Email provider for magic links
- `API_URL` — Backend URL (used by `apps/web` server-side)
- `REDIS_URL` — Used by `apps/api` and `apps/notifications`
- `CORS_ORIGIN` — Comma-separated origins for the API
- `NEXT_PUBLIC_PWA_URL` / `NEXT_PUBLIC_WEB_URL` — Public URLs
- `NOTIFICATIONS_WS_URL` / `VITE_NOTIFICATIONS_WS_URL` — WebSocket URL

### HTTPS for PWA (local dev)
The PWA runs over HTTPS by default (needed for service workers). Certs go in `apps/pwa/certificates/`. Generate with:
```bash
cd apps/pwa && pnpm generate-https-certs  # requires mkcert
```
