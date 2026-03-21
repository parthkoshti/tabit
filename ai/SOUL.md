# SOUL.md

This file provides guidance when working with code in this repository.

## What This Is

Tab is a Splitwise-alternative for splitting expenses. It's a pnpm + Turborepo monorepo requiring Node >=24.

## Commands

### Development

```bash
pnpm install                          # Install all dependencies
pnpm run build --filter=models --filter=db --filter=otel  # Build shared packages first (required before dev)
pnpm dev                              # Run all apps concurrently (pwa, api, notifications; web excluded)
pnpm dev:pwa                          # Run only the PWA
pnpm dev:web                          # Run only the landing page (independent of turbo)
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
- `apps/pwa` — Vite + React SPA, the main expense-splitting app (port 3003)
- `apps/api` — Hono REST API (port 3001), the backend for all data operations
- `apps/notifications` — WebSocket server (port 3002), uses Redis pub/sub + web-push
- `apps/mcp` — MCP server exposing tab/friend tools
- `packages/db` — Drizzle ORM schema, client, migrations (PostgreSQL)
- `packages/models` — Shared Zod schemas and TypeScript types
- `packages/auth` — Better Auth configuration (magic link / email OTP only, emails via Plunk)
- `packages/shared` — Shared utilities (e.g. `createId`)
- `packages/otel` — OpenTelemetry setup (logs + traces to OTLP/SigNoz)
- `packages/services` — Business logic layer (expense, tab, settlement, friend, user, tab-invite); used by `api` and `mcp`
- `packages/data` — Data access layer (query functions used by `services`, `api`, and `web`)

### Key Architectural Patterns

**API proxy in PWA**: The PWA proxies `/api/auth` → `api:3001/api/auth` (pass-through) and `/api/*` → `api:3001/v1/*` (rewrite). All API calls in `apps/pwa/lib/api-client.ts` use base `/api`. Backend app routes live under `/v1`.

**Auth**: Better Auth handles sessions. The `packages/auth` package exports a configured `auth` instance used by both the API (at `/api/auth/*`) and server-side in `apps/web`. The PWA uses `better-auth/react` via `apps/pwa/lib/auth-client.ts`.

**Database**: Drizzle ORM with PostgreSQL. Schema is split into `schema/auth.ts` (Better Auth managed tables) and `schema/app.ts` (application tables: tabs, expenses, settlements, friends, etc.). The `packages/data` package contains query logic organized into `tab`, `expense`, `settlement`, and `activity` namespaces.

**Services layer**: The API and MCP use `packages/services` for business logic (validation, authorization, notifications). Services call `packages/data` for persistence. Service tests mock the data layer and cover auth, validation, and success paths.

**PWA data flow**: TanStack Query for server state with IndexedDB (`idb-keyval`) persistence. Zustand for client UI state (`lib/stores/ui-store.ts`, `lib/stores/nav-store.ts`). Query keys are defined in `lib/query-keys.ts`.

**PWA routing**: React Router DOM v7. Route definitions are in `src/routes/app-layout-routes.tsx`. Page components live in `app/(app)/` following a Next.js-style directory convention (but it's React Router, not Next.js App Router).

**Alias**: `@` maps to the root of `apps/pwa` (i.e., `apps/pwa/`), so `@/app/...` refers to `apps/pwa/app/...` and `@/lib/...` to `apps/pwa/lib/...`.

**AI feature**: The API has an `/ai/add-expense` endpoint using Google AI SDK (`@ai-sdk/google`) for natural language expense entry.

**Real-time**: The `apps/notifications` server bridges Redis pub/sub messages (published by the API after mutations) to WebSocket clients and sends web push notifications via `web-push`.

**Exchange rates (FX)**: Conversion uses [Frankfurter](https://www.frankfurter.dev/) (`packages/services/src/integrations/frankfurter.ts`). Business logic lives in `packages/services/src/fx-rate.ts`; persistence in `packages/data/src/fx-rate.ts` table `fx_rate_snapshot` keyed by `(rateDate, base)` where **`base` is the expense currency** (not the tab currency). Cache hit: multiply `originalAmount` by `rates[tabCurrency]`. On miss, fetch from Frankfurter (historical date or `latest` when the expense date is after today UTC), then upsert; if the API returns a different working day than requested, the same rates are also stored under the requested calendar day (“alias”) so the next lookup hits. **`warmLatestRatesForBases(["EUR","USD"])`** in `apps/api/src/index.ts` (cron 16:00 Europe/Berlin + startup) only prefetches **latest** full rate maps for EUR and USD bases to reduce cold cache misses for those currencies; **any other expense currency** (e.g. AUD→INR tab) still works: first conversion for that date/base triggers a fetch and caches under that base.

### Environment Variables

All apps read from a root `.env` / `.env.local` file (via `dotenv-cli`). Key variables:

- `DATABASE_URL` — PostgreSQL connection string
- `BETTER_AUTH_SECRET` — Auth secret
- `VITE_BACKEND_URL` — Backend API URL; used by PWA (client), auth (baseURL), and API container
- `BETTER_AUTH_COOKIE_DOMAIN` — Optional; e.g. `.tabit.in` for cross-subdomain cookies
- `PLUNK_SECRET_KEY` — Email provider for magic links
- `REDIS_URL` — Used by `apps/api` and `apps/notifications`
- `CORS_ORIGIN` — Comma-separated origins for the API
- `NEXT_PUBLIC_PWA_URL` / `NEXT_PUBLIC_WEB_URL` — Public URLs
- `NOTIFICATIONS_WS_URL` / `VITE_NOTIFICATIONS_WS_URL` — WebSocket URL

**OpenTelemetry (optional)**: When `OTEL_EXPORTER_OTLP_ENDPOINT` is set, logs and traces are sent to SigNoz or any OTLP-compatible backend. Variables: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` (e.g. `signoz-ingestion-key=<key>` for SigNoz Cloud), `OTEL_SERVICE_NAME`, `OTEL_SDK_DISABLED`, `OTEL_TRACES_EXPORTER`, `OTEL_LOGS_EXPORTER`.

### HTTPS for PWA (local dev)

The PWA runs over HTTPS by default (needed for service workers). Certs go in `certs/` at repo root and are shared by PWA and notifications. Generate with:

```bash
pnpm generate-https-certs  # requires mkcert
```

## UI Conventions

**Mobile first**: PWA and web are designed mobile-first. Optimize for small screens first, then scale up.

**Display names**: When showing avatar names or user names in the UI (e.g. "Parth Koshti"), always display first name + last initial only (e.g. "Parth K"). Exception: in the friends list, display full names.

## Releases

**User-facing changelog**: Release notes in `apps/pwa/public/changelog.json` are shown to users in the UpdateGate modal. Write for users, not developers. Focus on how changes affect them and what new features are available. Avoid implementation details (e.g. "optimistic updates", "picker trigger")—describe benefits and capabilities instead.
