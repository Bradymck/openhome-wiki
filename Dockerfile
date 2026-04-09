FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY scripts/discord-bot.js scripts/
COPY wiki/ wiki/

# Non-root user for safety
RUN addgroup -S botgroup && adduser -S botuser -G botgroup
USER botuser

CMD ["node", "scripts/discord-bot.js"]
