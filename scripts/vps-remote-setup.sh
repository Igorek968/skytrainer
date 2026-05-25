#!/bin/sh
set -e
cd /opt/skytrainer
AUTH=$(openssl rand -hex 32)
CRON=$(openssl rand -hex 32)
PGPASS=$(openssl rand -hex 16)
cat > .env.qa <<EOF
APP_DOMAIN=utrainer.ru
APP_PUBLIC_URL=https://utrainer.ru
CADDYFILE=Caddyfile
POSTGRES_USER=sky
POSTGRES_PASSWORD=${PGPASS}
POSTGRES_DB=skytrainer_new
SKIINSTRUCT_DATABASE_URL=postgres://sky:${PGPASS}@postgres:5432/skytrainer_new?schema=skiinstruct
SKIINSTRUCT_AUTH_SECRET=${AUTH}
SKIINSTRUCT_CRON_SECRET=${CRON}
SKIINSTRUCT_ADMIN_EMAIL=admin@skiinstruct.local
SKIINSTRUCT_ADMIN_PASSWORD=Admin12345!
SKIINSTRUCT_ADMIN_NAME=Администратор
ALLOW_MOCK_CHECKOUT=1
SKIINSTRUCT_PASSWORD_RESET_DEBUG=0
SKIINSTRUCT_SERVER_ACTIONS_ALLOWED_ORIGINS=utrainer.ru,www.utrainer.ru
EOF
chmod 600 .env.qa
{
  echo "APP=https://utrainer.ru"
  echo "ADMIN=admin@skiinstruct.local / Admin12345!"
  echo "POSTGRES_PASSWORD=${PGPASS}"
} > /root/skytrainer-deploy-secrets.txt
chmod 600 /root/skytrainer-deploy-secrets.txt
echo "env ready"
