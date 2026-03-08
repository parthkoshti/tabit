# Stage 1: Install dependencies
FROM node:24-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/notifications/package.json apps/notifications/
COPY packages/auth/package.json packages/auth/
COPY packages/data/package.json packages/data/
COPY packages/db/package.json packages/db/
COPY packages/models/package.json packages/models/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:24-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_APP_URL=https://localhost:3000
ARG NEXT_PUBLIC_API_URL=/api-backend
ARG NEXT_PUBLIC_NOTIFICATIONS_WS_URL=ws://localhost:3002

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_NOTIFICATIONS_WS_URL=$NEXT_PUBLIC_NOTIFICATIONS_WS_URL

RUN printf "NEXT_PUBLIC_APP_URL=%s\nNEXT_PUBLIC_API_URL=%s\nNEXT_PUBLIC_NOTIFICATIONS_WS_URL=%s\n" \
    "$NEXT_PUBLIC_APP_URL" "$NEXT_PUBLIC_API_URL" "$NEXT_PUBLIC_NOTIFICATIONS_WS_URL" > .env

RUN pnpm exec turbo build --filter='!mcp'

# Stage 3: Production
FROM node:24-alpine AS prod
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/turbo.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages

EXPOSE 3000 3002

CMD ["pnpm", "start:prod"]
