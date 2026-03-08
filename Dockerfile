# Stage 1: Prepare - prune monorepo for target workspaces
FROM node:24-alpine AS prepare
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

# Install turbo for prune (minimal, no full monorepo install)
RUN pnpm add -g turbo@^2

COPY . .
RUN turbo prune web api notifications --docker

# Stage 2: Install dependencies (only when package.json/lockfile change)
FROM node:24-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /app

# Copy pruned package.json files and lockfile first (better layer caching)
COPY --from=prepare /app/out/json/ .
RUN pnpm install --frozen-lockfile

# Copy full source
COPY --from=prepare /app/out/full/ .

ARG NEXT_PUBLIC_APP_URL=https://localhost:3000
ARG NEXT_PUBLIC_API_URL=/api-backend
ARG NEXT_PUBLIC_NOTIFICATIONS_WS_URL=ws://localhost:3002
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_NOTIFICATIONS_WS_URL=$NEXT_PUBLIC_NOTIFICATIONS_WS_URL
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

RUN printf "NEXT_PUBLIC_APP_URL=%s\nNEXT_PUBLIC_API_URL=%s\nNEXT_PUBLIC_NOTIFICATIONS_WS_URL=%s\nNEXT_PUBLIC_VAPID_PUBLIC_KEY=%s\n" \
    "$NEXT_PUBLIC_APP_URL" "$NEXT_PUBLIC_API_URL" "$NEXT_PUBLIC_NOTIFICATIONS_WS_URL" "$NEXT_PUBLIC_VAPID_PUBLIC_KEY" > .env

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

EXPOSE 3000 3002

CMD ["pnpm", "start:prod"]
