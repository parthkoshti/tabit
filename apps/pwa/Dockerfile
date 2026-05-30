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
RUN apk add --no-cache curl
RUN curl -sLf --retry 3 https://cli.doppler.com/install.sh | sh
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

COPY --from=prepare /app/out/json/ .
RUN pnpm install --frozen-lockfile

COPY --from=prepare /app/out/full/ .

ARG NEXT_PUBLIC_PWA_URL=
ARG VITE_API_URL=
ARG VITE_REALTIME_URL=
ARG NEXT_PUBLIC_DONATE_URL=
ARG VITE_VAPID_PUBLIC_KEY=
ARG OTEL_EXPORTER_OTLP_ENDPOINT=
ARG OTEL_EXPORTER_OTLP_HEADERS=
ARG OTEL_SERVICE_NAME=
ARG DOPPLER_TOKEN=
ARG TURBO_TEAM
ARG TURBO_TOKEN

ENV NEXT_PUBLIC_PWA_URL=$NEXT_PUBLIC_PWA_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_REALTIME_URL=$VITE_REALTIME_URL
ENV NEXT_PUBLIC_DONATE_URL=$NEXT_PUBLIC_DONATE_URL
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY
ENV OTEL_EXPORTER_OTLP_ENDPOINT=$OTEL_EXPORTER_OTLP_ENDPOINT
ENV OTEL_EXPORTER_OTLP_HEADERS=$OTEL_EXPORTER_OTLP_HEADERS
ENV OTEL_SERVICE_NAME=$OTEL_SERVICE_NAME
ENV DOPPLER_TOKEN=$DOPPLER_TOKEN
ENV TURBO_TEAM=$TURBO_TEAM
ENV TURBO_TOKEN=$TURBO_TOKEN

RUN if [ -n "$DOPPLER_TOKEN" ]; then doppler run -- pnpm exec turbo build --filter=pwa...; else pnpm exec turbo build --filter=pwa...; fi

# Stage 3: Production
FROM nginx:1.27-alpine AS prod
WORKDIR /usr/share/nginx/html

COPY --from=builder /app/apps/pwa/dist .
COPY apps/pwa/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3003

CMD ["nginx", "-g", "daemon off;"]
