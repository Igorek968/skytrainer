#!/bin/sh
set -e

MODE="${SKIINSTRUCT_NEXT_MODE:-prod}"
export NODE_ENV="${SKIINSTRUCT_NODE_ENV:-production}"

echo "[entry] SKIINSTRUCT_NEXT_MODE=$MODE NODE_ENV=$NODE_ENV"

# db push только при изменении schema (экономит 10–30 с на каждом restart)
SCHEMA_FILE="prisma/schema.prisma"
SCHEMA_MARKER=".next/.schema-push-hash"
if [ -f "$SCHEMA_FILE" ]; then
  SCHEMA_HASH=$(md5sum "$SCHEMA_FILE" 2>/dev/null | cut -d' ' -f1 || cksum "$SCHEMA_FILE" | cut -d' ' -f1)
  if [ -f "$SCHEMA_MARKER" ] && [ "$(cat "$SCHEMA_MARKER")" = "$SCHEMA_HASH" ]; then
    echo "[entry] prisma db push — пропуск (schema не менялась)"
  else
    echo "[entry] prisma db push..."
    npx prisma db push --accept-data-loss
    mkdir -p .next
    echo "$SCHEMA_HASH" > "$SCHEMA_MARKER"
  fi
else
  npx prisma db push --accept-data-loss
fi

echo "[entry] prisma generate..."
npx prisma generate

echo "[entry] bootstrap admin..."
npm run db:bootstrap-admin

if [ "${SKIINSTRUCT_RUN_SEED:-0}" = "1" ]; then
  npm run db:seed:instructors
fi

if [ "$MODE" = "dev" ]; then
  echo "[entry] ВНИМАНИЕ: next dev в Docker на Windows — переходы по минутам."
  exec npx next dev --hostname 0.0.0.0 --port 3000
fi

PROD_MARKER=".next/.skiinstruct-prod-build"
HAS_BUILD=0
if [ -f ".next/BUILD_ID" ]; then
  HAS_BUILD=1
fi
if [ "${SKIINSTRUCT_FORCE_REBUILD:-0}" = "1" ]; then
  echo "[entry] prod: next build (SKIINSTRUCT_FORCE_REBUILD=1)..."
  npm run build
  touch "$PROD_MARKER"
elif [ -f "$PROD_MARKER" ] || [ "$HAS_BUILD" = "1" ]; then
  touch "$PROD_MARKER" 2>/dev/null || true
  echo "[entry] prod: готовый build (пропуск сборки)"
else
  echo "[entry] prod: next build (первый раз 3–15 мин)..."
  npm run build
  touch "$PROD_MARKER"
fi

echo "[entry] prod: next start :3000"
exec npx next start --hostname 0.0.0.0 --port 3000
