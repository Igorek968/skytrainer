#!/bin/sh
# Однократно: перенос сертификатов из старого Docker-тома в deploy/caddy-data на VPS.
set -e
cd /opt/skytrainer
mkdir -p deploy/caddy-data deploy/caddy-config
if docker volume inspect skytrainer_skytrainer_qa_caddy_data >/dev/null 2>&1; then
  docker run --rm \
    -v skytrainer_skytrainer_qa_caddy_data:/from:ro \
    -v "$(pwd)/deploy/caddy-data:/to" \
    alpine:3.20 sh -c "cp -a /from/. /to/ 2>/dev/null || true"
  echo "migrated caddy_data volume"
fi
if docker volume inspect skytrainer_skytrainer_qa_caddy_config >/dev/null 2>&1; then
  docker run --rm \
    -v skytrainer_skytrainer_qa_caddy_config:/from:ro \
    -v "$(pwd)/deploy/caddy-config:/to" \
    alpine:3.20 sh -c "cp -a /from/. /to/ 2>/dev/null || true"
  echo "migrated caddy_config volume"
fi
ls -la deploy/caddy-data 2>/dev/null | head -5
