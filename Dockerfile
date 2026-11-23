FROM node:22-bookworm-slim

ENV NODE_ENV=production PORT=8080
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY api ./api
COPY src ./src
COPY publico ./publico
COPY documentacao/tutoriais-frutlog.json documentacao/assistente-frutlog.md ./documentacao/

USER node
EXPOSE 8080
CMD ["node", "src/server.js"]
