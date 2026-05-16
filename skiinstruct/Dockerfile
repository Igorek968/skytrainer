FROM node:20-alpine

WORKDIR /app

# Меньше шума при установке (audit/fund). Уровень лога не отключаем — при ошибке npm видно причину.
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false

COPY package*.json ./
# postinstall запускает prisma generate — нужна схема до npm install
COPY prisma ./prisma
RUN npm install

COPY . .

RUN sed -i 's/\r$//' /app/scripts/docker-dev-entrypoint.sh 2>/dev/null || true \
  && chmod +x /app/scripts/docker-dev-entrypoint.sh

RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "/app/scripts/docker-dev-entrypoint.sh"]
