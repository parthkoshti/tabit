# SOUL.md

This file provides guidance when working with code in this repository.

## What This Is

Tab is a Splitwise-alternative for splitting expenses. It's a pnpm + Turborepo monorepo requiring Node >=24.

## Commands

### Development

```bash
pnpm install                          # Install all dependencies
pnpm run build --filter=models --filter=db --filter=otel  # Build shared packages first (required before dev)
pnpm dev                              # Run all apps concurrently (pwa, api, workers; web excluded)
pnpm dev:pwa                          # Run only the PWA
pnpm dev:web                          # Run only the landing page (independent of turbo)
```

### Database

```bash
cd packages/db && pnpm db:push        # Push schema (dev; uses Doppler for env)
cd packages/db && pnpm db:generate    # Generate migration files (never hand-edit journal)
cd packages/db && pnpm db:migrate     # Run migrations
cd packages/db && pnpm db:studio      # Open Drizzle Studio
```

### Type checking & linting

```bash
pnpm check                            # TypeScript check across all packages
pnpm lint                             # ESLint across all packages
# Per-package: cd apps/pwa && pnpm check
```

### Testing

```bash
pnpm test                             # Run all tests (Vitest, via Turbo)
pnpm test:watch                       # Watch mode
pnpm --filter services test           # Run only services package tests
```

### Production

```bash
pnpm start:prod                       # Runs db:migrate:prod then starts all services
```

## Architecture

### Monorepo Structure

- `apps/web` — Next.js 15 landing page (port 3000), uses App Router; independent app (not in turbo)
- `apps/pwa` — Vite + React SPA (port 3003), TanStack Router/Query/Form, oRPC client, Socket.IO realtime
- `apps/api` — Hono API (port 3001): Better Auth at `/api/auth/*`, oRPC at `/rpc/*`, `GET /health`
- `apps/workers` — Socket.IO + BullMQ notification delivery + web-push + node-cron (port 3002)
- `packages/db` — Drizzle ORM schema, client, migrations (PostgreSQL)
- `packages/models` — Shared Zod schemas and TypeScript types
- `packages/rpc` — oRPC `appRouter` (procedures call `services`)
- `packages/queue` — BullMQ `notifications` queue + worker factory
- `packages/auth` — Better Auth (email OTP, 30-day sessions, emails via Plunk)
- `packages/shared` — Shared utilities (e.g. `createId`)
- `packages/otel` — OpenTelemetry setup (logs + traces to OTLP/SigNoz)
- `packages/services` — Business logic; used by `rpc` procedures and workers
- `packages/data` — Data access layer (used by `services` only; not imported in PWA)

### Key Architectural Patterns

**PWA dev proxy**: Vite proxies `/api/auth` and `/rpc` to `api:3001`. Client uses `VITE_API_URL` (production: `https://api.tabit.in`) and `VITE_REALTIME_URL` (`https://wrk.tabit.in`). The oRPC client lives in `apps/pwa/src/lib/orpc-client.ts`; `apps/pwa/lib/api.ts` is a compatibility facade with `{ success, error }` shape.

**Auth**: Better Auth at `/api/auth/*` on the API. Sessions are 30 days. PWA uses `better-auth/react` via `apps/pwa/lib/auth-client.ts` with `credentials: 'include'`.

**API**: No REST `/v1`. All app mutations and reads go through oRPC (`packages/rpc`) mounted at `/rpc/*` on `apps/api`.

**Database**: Drizzle ORM with PostgreSQL. Schema in `packages/db` (`schema/auth.ts`, `schema/app.ts`). Query logic in `packages/data`; business rules in `packages/services`.

**PWA data flow**: TanStack Query + IDB persistence (`apps/pwa/src/lib/query-client.ts`). Cache buster from `__APP_VERSION__` on deploy. Route loaders prefetch via `apps/pwa/src/lib/route-loaders.ts`. Zustand for UI state.

**PWA routing**: TanStack Router file-based routes under `apps/pwa/src/routes/`. Page components still live in `apps/pwa/app/` (imported by route files). Navigation shim: `apps/pwa/lib/navigation.ts`.

**Forms**: `@tanstack/react-form` + Zod from `models`; helper `apps/pwa/lib/form-zod.ts`.

**AI feature**: oRPC `ai` procedures (Google Generative AI) for natural-language expense entry.

**Real-time**: `apps/workers` runs Socket.IO (cookie session auth, room `user:{userId}`, event `notification`). After mutations, `notificationService` enqueues BullMQ jobs; the worker emits Socket.IO **and** web push (always push, even if socket connected). PWA: `apps/pwa/src/lib/realtime-manager.ts` + `use-notifications.ts`. On connect, heal gaps via `notifications.listMissed`. For **`expense_added`**, payload `fromUserId` / `fromUserName` are the **payer** (`paidById`).

**Payment reminders**: Direct tab **Remind** calls oRPC `friends.sendPaymentReminder`. Push copy from `packages/models/src/notification.ts`.

**Exchange rates (FX)**: Frankfurter via `packages/services/src/fx-rate.ts`. Crons run in **`apps/workers`** (FX daily 16:00 Europe/Berlin, recurring every 15m), not in the API.

**Placeholder friends**: Merge via oRPC `tabs` procedures. PWA members UI at `/tabs/:tabId/members`.

**Offline**: IndexedDB queue (`apps/pwa/lib/offline-queue.ts`) for friend/tab invite actions plus expense CRUD and settlements; sync on `online` and service worker `PROCESS_OFFLINE_QUEUE` message. Server wins on conflict (toast).

### Environment Variables

Prefer **Doppler** (`doppler run --`) for dev and Docker (`DOPPLER_TOKEN_*`). Fallback: root `.env` / `.env.local`. See `.env.example`.

- `DATABASE_URL` — PostgreSQL
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_COOKIE_DOMAIN`, `BETTER_AUTH_TRUSTED_ORIGINS`
- `VITE_API_URL` — API origin for PWA + auth `baseURL` (e.g. `https://api.tabit.in`)
- `VITE_REALTIME_URL` — Socket.IO workers origin (e.g. `https://wrk.tabit.in`)
- `REDIS_URL` — BullMQ + shared Redis
- `CORS_ORIGIN`, `NEXT_PUBLIC_PWA_URL`, `NEXT_PUBLIC_WEB_URL`
- `VAPID_*` / `VITE_VAPID_PUBLIC_KEY` — Web push
- `DISCORD_WEBHOOK_URL` — Cron/job failure alerts in workers

**OpenTelemetry (optional)**: When `OTEL_EXPORTER_OTLP_ENDPOINT` is set, logs and traces are sent to SigNoz or any OTLP-compatible backend. Variables: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` (e.g. `signoz-ingestion-key=<key>` for SigNoz Cloud), `OTEL_SERVICE_NAME`, `OTEL_SDK_DISABLED`, `OTEL_TRACES_EXPORTER`, `OTEL_LOGS_EXPORTER`.

### HTTPS for PWA (local dev)

The PWA runs over HTTPS by default (needed for service workers). Certs go in `certs/` at repo root. Generate with:

```bash
pnpm generate-https-certs  # requires mkcert
```

## UI Conventions

**Mobile first**: PWA and web are designed mobile-first. Optimize for small screens first, then scale up.

**Display names**: When showing avatar names or user names in the UI (e.g. "Parth Koshti"), always display first name + last initial only (e.g. "Parth K"). Exception: in the friends list, display full names.

## Releases

**User-facing changelog**: Release notes in `apps/pwa/public/changelog.json` are shown to users in the UpdateGate modal. Write for users, not developers. Focus on how changes affect them and what new features are available. Avoid implementation details (e.g. "optimistic updates", "picker trigger")—describe benefits and capabilities instead.
