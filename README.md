# Tab It - Split expenses with friends

A Splitwise alternative built with Next.js 15, PWA, PostgreSQL, Drizzle, Better Auth (magic link), TanStack Query, Zustand, and IndexedDB-backed query cache.

## Project structure

- `apps/web` - Landing page (tabit.in), port 3000
- `apps/pwa` - Main expense splitting app (apps.tabit.in), port 3003
- `apps/api` - Hono REST API, port 3001
- `apps/notifications` - WebSocket server for real-time notifications, port 3002
- `apps/mcp` - MCP server (tools for tabs, friends)
- `packages/db` - Drizzle schema, client, migrations
- `packages/models` - Shared Zod schemas and types
- `packages/auth` - Better Auth configuration
- `packages/shared` - Shared utilities
- `packages/data` - Data layer

## Setup

1. Copy `apps/web/.env.example` to `.env` or `.env.local` at the project root and fill in:
   - `DATABASE_URL` - PostgreSQL connection string
   - `VITE_APP_URL` - Landing URL (e.g. http://localhost:3000)
   - `VITE_PWA_URL` - PWA app URL (e.g. https://localhost:3003)
   - `BETTER_AUTH_SECRET` - Secret for Better Auth (min 32 chars)
   - `BETTER_AUTH_URL` - Same as VITE_PWA_URL when developing PWA
   - `PLUNK_SECRET_KEY` - Plunk API key for magic link emails
   - `API_URL` - API base URL (e.g. http://localhost:3001)
   - `REDIS_URL` - Redis connection string (for API and notifications)
   - `NOTIFICATIONS_WS_URL` / `VITE_NOTIFICATIONS_WS_URL` - WebSocket URL for notifications
   - `CORS_ORIGIN` - Comma-separated origins for API (use https when using PWA with HTTPS)

2. Install dependencies and build packages:

```bash
pnpm install
pnpm run build --filter=models --filter=db
```

3. Run database migrations:

```bash
cd packages/db && pnpm db:push
```

Or with migrations:

```bash
cd packages/db && pnpm db:migrate
```

4. Generate PWA icons (optional - placeholders are included):

```bash
pnpm generate-icons
```

5. Start the app:

```bash
pnpm dev
```

This runs web, pwa, api, and notifications concurrently. For production:

```bash
pnpm start:prod
```

## PWA testing with HTTPS locally

The PWA app uses HTTPS by default for service worker and push notification support. To access from another device on your network (e.g. iPhone), generate certs that include your local IP:

```bash
cd apps/pwa && pnpm generate-https-certs
```

Requires [mkcert](https://github.com/FiloSottile/mkcert) (`brew install mkcert && mkcert -install`).

**SSL error when using 192.168.x.x:**

1. Install mkcert: `brew install mkcert && mkcert -install`
2. Generate certs: `cd apps/pwa && pnpm generate-https-certs`
3. Restart: `pnpm dev`

**Accessing from iPhone/another device:** The device must trust the mkcert CA. On your Mac, run `mkcert -CAROOT` to get the CA path. Copy `rootCA.pem` to the device (AirDrop, etc.), install the profile, then Settings > General > About > Certificate Trust Settings > enable trust for the mkcert root.

## Docker

```bash
docker build --build-arg TURBO_TEAM=$TURBO_TEAM --build-arg TURBO_TOKEN=$TURBO_TOKEN -t tabit .
docker run -p 3000:3000 -p 3002:3002 -p 3003:3003 --env-file .env tabit
```

## Tech stack

- Next.js 15
- PostgreSQL + Drizzle ORM
- Better Auth (magic link only, emails via Plunk)
- TanStack Query + IndexedDB persistence
- Zustand
- PWA (manifest, service worker)
- Hono (API)
- Redis (caching, notifications)
- Web Push (optional)
