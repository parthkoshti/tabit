# Tabit - Split expenses with friends

A Splitwise alternative built with Next.js 16, PWA, PostgreSQL, Drizzle, Better Auth (magic link), TanStack Query, Zustand, and IndexedDB-backed query cache.

## Setup

1. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in:
   - `DATABASE_URL` - PostgreSQL connection string
   - `NEXT_PUBLIC_APP_URL` - App URL (e.g. http://localhost:3000)
   - `BETTER_AUTH_SECRET` - Secret for Better Auth (min 32 chars)
   - `BETTER_AUTH_URL` - Same as NEXT_PUBLIC_APP_URL
   - `PLUNK_SECRET_KEY` - Plunk API key for magic link emails

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

For PWA testing with HTTPS locally:

```bash
pnpm dev
```

To access from another device on your network (e.g. iPhone), generate certs that include your local IP:

```bash
cd apps/web && pnpm generate-https-certs
```

Requires [mkcert](https://github.com/FiloSottile/mkcert) (`brew install mkcert && mkcert -install`).

**SSL error when using 192.168.x.x:**

1. Install mkcert: `brew install mkcert && mkcert -install`
2. Generate certs: `pnpm generate-https-certs`
3. Restart: `pnpm dev`

**Accessing from iPhone/another device:** The device must trust the mkcert CA. On your Mac, run `mkcert -CAROOT` to get the CA path. Copy `rootCA.pem` to the device (AirDrop, etc.), install the profile, then Settings > General > About > Certificate Trust Settings > enable trust for the mkcert root.

## Project structure

- `apps/web` - Next.js 16 PWA app
- `packages/models` - Shared Zod schemas and types
- `packages/db` - Drizzle schema, client, migrations

## Tech stack

- Next.js 16
- PostgreSQL + Drizzle ORM
- Better Auth (magic link only, emails via Plunk)
- TanStack Query + IndexedDB persistence
- Zustand
- PWA (manifest, service worker)
