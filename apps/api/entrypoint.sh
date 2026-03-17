#!/bin/sh
set -e
pnpm --filter=db db:migrate:prod
exec pnpm --filter=api start:prod
