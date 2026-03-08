# Stage 1: Install dependencies
FROM node:24-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY . .

RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:24-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY --from=deps /app/packages/auth/node_modules ./packages/auth/node_modules
COPY --from=deps /app/packages/data/node_modules ./packages/data/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/models/node_modules ./packages/models/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

ARG NEXT_PUBLIC_APP_URL=https://localhost:3000
ARG NEXT_PUBLIC_API_URL=/api-backend
ARG NEXT_PUBLIC_NOTIFICATIONS_WS_URL=ws://localhost:3002

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_NOTIFICATIONS_WS_URL=$NEXT_PUBLIC_NOTIFICATIONS_WS_URL

RUN printf "NEXT_PUBLIC_APP_URL=%s\nNEXT_PUBLIC_API_URL=%s\nNEXT_PUBLIC_NOTIFICATIONS_WS_URL=%s\n" \
    "$NEXT_PUBLIC_APP_URL" "$NEXT_PUBLIC_API_URL" "$NEXT_PUBLIC_NOTIFICATIONS_WS_URL" > .env

RUN pnpm build

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
