#!/bin/sh
set -e
pnpm --filter=db db:migrate:prod
if [ -n "$DOPPLER_TOKEN" ]; then
  exec doppler run -- pnpm --filter=api start:prod
fi
exec pnpm --filter=api start:prod
