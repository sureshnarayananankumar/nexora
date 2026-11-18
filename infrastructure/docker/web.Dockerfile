# syntax=docker/dockerfile:1.7
# ── NEXORA product app (React 19 + Vite) · build context: repository root ──
# glibc base: Rollup's native parser can overflow musl's small default thread stack on Alpine.
FROM node:22-bookworm-slim AS build
# Mirror the repo layout: the app imports ../../demo-api (only used by the GitHub Pages demo build).
WORKDIR /src/frontend/react-client
COPY frontend/react-client/package.json frontend/react-client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/demo-api/ /src/frontend/demo-api/
COPY frontend/react-client/ ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY infrastructure/nginx/spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/frontend/react-client/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
