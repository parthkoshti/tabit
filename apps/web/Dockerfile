# Stage 1: Prepare - prune monorepo for web only
FROM node:24-alpine AS prepare
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

RUN pnpm add -g turbo@^2

COPY . .
RUN turbo prune web --docker

# Stage 2: Install dependencies
FROM node:24-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

COPY --from=prepare /app/out/json/ .
RUN pnpm install --frozen-lockfile

COPY --from=prepare /app/out/full/ .

ARG VITE_BACKEND_URL=
ARG NEXT_PUBLIC_WEB_URL=
ARG NEXT_PUBLIC_PWA_URL=
ARG NEXT_PUBLIC_DONATE_URL=
ARG NEXT_PUBLIC_RYBBIT_SCRIPT_URL=
ARG NEXT_PUBLIC_WEB_RYBBIT_SITE_ID=
ARG OTEL_EXPORTER_OTLP_ENDPOINT=
ARG OTEL_EXPORTER_OTLP_HEADERS=
ARG OTEL_SERVICE_NAME=

ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL
ENV NEXT_PUBLIC_PWA_URL=$NEXT_PUBLIC_PWA_URL
ENV NEXT_PUBLIC_DONATE_URL=$NEXT_PUBLIC_DONATE_URL
ENV NEXT_PUBLIC_RYBBIT_SCRIPT_URL=$NEXT_PUBLIC_RYBBIT_SCRIPT_URL
ENV NEXT_PUBLIC_WEB_RYBBIT_SITE_ID=$NEXT_PUBLIC_WEB_RYBBIT_SITE_ID
ENV OTEL_EXPORTER_OTLP_ENDPOINT=$OTEL_EXPORTER_OTLP_ENDPOINT
ENV OTEL_EXPORTER_OTLP_HEADERS=$OTEL_EXPORTER_OTLP_HEADERS
ENV OTEL_SERVICE_NAME=$OTEL_SERVICE_NAME

ARG TURBO_TEAM
ARG TURBO_TOKEN
ENV TURBO_TEAM=$TURBO_TEAM
ENV TURBO_TOKEN=$TURBO_TOKEN

RUN pnpm build

# Stage 3: Production
FROM node:24-alpine AS prod
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/turbo.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/packages ./packages

EXPOSE 3000

CMD ["pnpm", "--filter=web", "start:prod"]
