# Stage 1: Prepare - prune monorepo for workers only
FROM node:24-alpine AS prepare
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

RUN pnpm add -g turbo@^2

COPY . .
RUN turbo prune workers --docker

# Stage 2: Install dependencies
FROM node:24-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

COPY --from=prepare /app/out/json/ .
RUN pnpm install --frozen-lockfile

COPY --from=prepare /app/out/full/ .

ARG TURBO_TEAM
ARG TURBO_TOKEN
ENV TURBO_TEAM=$TURBO_TEAM
ENV TURBO_TOKEN=$TURBO_TOKEN

RUN pnpm exec turbo build --filter=workers...

# Stage 3: Production
FROM node:24-alpine AS prod
RUN apk add --no-cache curl
RUN curl -sLf --retry 3 https://cli.doppler.com/install.sh | sh
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/turbo.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/packages ./packages

EXPOSE 3002

CMD ["doppler", "run", "--", "pnpm", "--filter=workers", "start:prod"]
