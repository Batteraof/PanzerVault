FROM node:20-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

USER node

CMD ["node", "src/index.js"]
