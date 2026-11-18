# syntax=docker/dockerfile:1.7
# ── NEXORA realtime (Node.js 22, Socket.IO) · build context: repository root ──
FROM node:22-alpine AS build
WORKDIR /src
COPY backend/node-realtime/package.json backend/node-realtime/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY backend/node-realtime/tsconfig.json backend/node-realtime/tsconfig.build.json ./
COPY backend/node-realtime/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=build --chown=node:node /src/node_modules ./node_modules
COPY --from=build --chown=node:node /src/dist ./dist
COPY --chown=node:node backend/node-realtime/package.json ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://localhost:4000/health | grep -q '"UP"' || exit 1
CMD ["node", "dist/index.js"]
