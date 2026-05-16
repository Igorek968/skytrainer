#!/bin/sh
set -e

# Быстрый старт в Docker: без rm .prisma, без повторного seed при каждом up.
echo "[dev] prisma db push..."
npx prisma db push --accept-data-loss

echo "[dev] prisma generate..."
npx prisma generate

echo "[dev] bootstrap admin (если ещё нет)..."
npm run db:bootstrap-admin

if [ "${SKIINSTRUCT_RUN_SEED:-0}" = "1" ]; then
  echo "[dev] seed instructors..."
  npm run db:seed:instructors
else
  echo "[dev] seed пропущен (SKIINSTRUCT_RUN_SEED=1 — принудительно засеять)"
fi

echo "[dev] next dev (turbo) на :3000..."
exec npx next dev --turbo --hostname 0.0.0.0 --port 3000
