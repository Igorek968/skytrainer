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

RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "-c", "npm run db:push && npx prisma generate && npm run db:seed:instructors && npm run dev -- --hostname 0.0.0.0 --port 3000"]
