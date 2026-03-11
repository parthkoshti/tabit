# Stage 1: Prepare - prune monorepo for target workspaces
FROM node:24-alpine AS prepare
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

# Install turbo for prune (minimal, no full monorepo install)
RUN pnpm add -g turbo@^2

COPY . .
RUN turbo prune web pwa api notifications --docker

# Stage 2: Install dependencies (only when package.json/lockfile change)
FROM node:24-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /app

# Copy pruned package.json files and lockfile first (better layer caching)
COPY --from=prepare /app/out/json/ .
RUN pnpm install --frozen-lockfile

# Copy full source
COPY --from=prepare /app/out/full/ .

ARG VITE_APP_URL=https://localhost:3000
ARG VITE_PWA_URL=https://localhost:3003
ARG VITE_GITHUB_URL=
ARG VITE_DONATE_URL=
ARG VITE_NOTIFICATIONS_WS_URL=ws://localhost:3002
ARG VITE_VAPID_PUBLIC_KEY=
ARG RYBBIT_HOST=
ARG VITE_APP_RYBBIT_SITE_ID=
ARG VITE_RYBBIT_SCRIPT_URL=

ENV VITE_APP_URL=$VITE_APP_URL
ENV VITE_PWA_URL=$VITE_PWA_URL
ENV VITE_GITHUB_URL=$VITE_GITHUB_URL
ENV VITE_DONATE_URL=$VITE_DONATE_URL
ENV VITE_NOTIFICATIONS_WS_URL=$VITE_NOTIFICATIONS_WS_URL
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY
ENV RYBBIT_HOST=$RYBBIT_HOST
ENV VITE_APP_RYBBIT_SITE_ID=$VITE_APP_RYBBIT_SITE_ID
ENV VITE_RYBBIT_SCRIPT_URL=$VITE_RYBBIT_SCRIPT_URL

RUN printf "VITE_APP_URL=%s\nVITE_PWA_URL=%s\nVITE_GITHUB_URL=%s\nVITE_DONATE_URL=%s\nVITE_NOTIFICATIONS_WS_URL=%s\nVITE_VAPID_PUBLIC_KEY=%s\nRYBBIT_HOST=%s\nVITE_RYBBIT_SITE_ID=%s\nVITE_RYBBIT_SCRIPT_URL=%s\n" \
    "$VITE_APP_URL" "$VITE_PWA_URL" "$VITE_GITHUB_URL" "$VITE_DONATE_URL" "$VITE_NOTIFICATIONS_WS_URL" "$VITE_VAPID_PUBLIC_KEY" "$RYBBIT_HOST" "$VITE_APP_RYBBIT_SITE_ID" "$VITE_RYBBIT_SCRIPT_URL" > .env

ARG TURBO_TEAM
ARG TURBO_TOKEN
ENV TURBO_TEAM=$TURBO_TEAM
ENV TURBO_TOKEN=$TURBO_TOKEN

RUN pnpm build

# Stage 3: Production
FROM node:24-alpine AS prod
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/turbo.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/.env ./.env

EXPOSE 3000 3002 3003

CMD ["pnpm", "start:prod"]
