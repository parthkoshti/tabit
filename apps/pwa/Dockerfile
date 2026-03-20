# Stage 1: Prepare - prune monorepo for pwa only
FROM node:24-alpine AS prepare
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

RUN pnpm add -g turbo@^2

COPY . .
RUN turbo prune pwa --docker

# Stage 2: Install dependencies
FROM node:24-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

COPY --from=prepare /app/out/json/ .
RUN pnpm install --frozen-lockfile

COPY --from=prepare /app/out/full/ .

ARG NEXT_PUBLIC_PWA_URL=
ARG VITE_BACKEND_URL=
ARG NEXT_PUBLIC_DONATE_URL=
ARG VITE_NOTIFICATIONS_WS_URL=
ARG VITE_VAPID_PUBLIC_KEY=
ARG VITE_QUERY_CACHE_BUSTER=v1
ARG OTEL_EXPORTER_OTLP_ENDPOINT=
ARG OTEL_EXPORTER_OTLP_HEADERS=
ARG OTEL_SERVICE_NAME=

ENV NEXT_PUBLIC_PWA_URL=$NEXT_PUBLIC_PWA_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV NEXT_PUBLIC_DONATE_URL=$NEXT_PUBLIC_DONATE_URL
ENV VITE_NOTIFICATIONS_WS_URL=$VITE_NOTIFICATIONS_WS_URL
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY
ENV VITE_QUERY_CACHE_BUSTER=$VITE_QUERY_CACHE_BUSTER
ENV OTEL_EXPORTER_OTLP_ENDPOINT=$OTEL_EXPORTER_OTLP_ENDPOINT
ENV OTEL_EXPORTER_OTLP_HEADERS=$OTEL_EXPORTER_OTLP_HEADERS
ENV OTEL_SERVICE_NAME=$OTEL_SERVICE_NAME

ARG TURBO_TEAM
ARG TURBO_TOKEN
ENV TURBO_TEAM=$TURBO_TEAM
ENV TURBO_TOKEN=$TURBO_TOKEN

RUN pnpm exec turbo build --filter=pwa...

# Stage 3: Production
FROM nginx:1.27-alpine AS prod
WORKDIR /usr/share/nginx/html

# Copy built assets from builder stage
COPY --from=builder /app/apps/pwa/dist .

# Copy nginx configuration
COPY apps/pwa/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3003

CMD ["nginx", "-g", "daemon off;"]
