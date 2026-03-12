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

ARG NEXT_PUBLIC_WEB_URL=
ARG NEXT_PUBLIC_PWA_URL=
ARG NEXT_PUBLIC_GITHUB_URL=
ARG NEXT_PUBLIC_DONATE_URL=
ARG VITE_NOTIFICATIONS_WS_URL=
ARG VITE_VAPID_PUBLIC_KEY=
ARG RYBBIT_HOST=
ARG NEXT_PUBLIC_WEB_RYBBIT_SITE_ID=
ARG NEXT_PUBLIC_RYBBIT_SCRIPT_URL=

ENV NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL
ENV NEXT_PUBLIC_PWA_URL=$NEXT_PUBLIC_PWA_URL
ENV NEXT_PUBLIC_GITHUB_URL=$NEXT_PUBLIC_GITHUB_URL
ENV NEXT_PUBLIC_DONATE_URL=$NEXT_PUBLIC_DONATE_URL
ENV VITE_NOTIFICATIONS_WS_URL=$VITE_NOTIFICATIONS_WS_URL
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY
ENV RYBBIT_HOST=$RYBBIT_HOST
ENV NEXT_PUBLIC_WEB_RYBBIT_SITE_ID=$NEXT_PUBLIC_WEB_RYBBIT_SITE_ID
ENV NEXT_PUBLIC_RYBBIT_SCRIPT_URL=$NEXT_PUBLIC_RYBBIT_SCRIPT_URL

RUN printf "NEXT_PUBLIC_WEB_URL=%s\nNEXT_PUBLIC_PWA_URL=%s\nNEXT_PUBLIC_GITHUB_URL=%s\nNEXT_PUBLIC_DONATE_URL=%s\nVITE_NOTIFICATIONS_WS_URL=%s\nVITE_VAPID_PUBLIC_KEY=%s\nRYBBIT_HOST=%s\nVITE_RYBBIT_SITE_ID=%s\nNEXT_PUBLIC_RYBBIT_SCRIPT_URL=%s\n" \
    "$NEXT_PUBLIC_WEB_URL" "$NEXT_PUBLIC_PWA_URL" "$NEXT_PUBLIC_GITHUB_URL" "$NEXT_PUBLIC_DONATE_URL" "$VITE_NOTIFICATIONS_WS_URL" "$VITE_VAPID_PUBLIC_KEY" "$RYBBIT_HOST" "$NEXT_PUBLIC_WEB_RYBBIT_SITE_ID" "$NEXT_PUBLIC_RYBBIT_SCRIPT_URL" > .env

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
