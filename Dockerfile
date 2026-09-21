FROM node:22-slim

WORKDIR /app

# Устанавливаем зависимости по локфайлу (воспроизводимо)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Копируем исходный код (бэкенд + статику фронтенда)
COPY backend ./backend
COPY frontend ./frontend

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
EXPOSE 3000

CMD ["node", "backend/src/server.js"]
