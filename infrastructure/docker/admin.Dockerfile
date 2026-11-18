# syntax=docker/dockerfile:1.7
# ── NEXORA admin console (Angular 20) · build context: repository root ──
# glibc base for the build stage (same reason as web.Dockerfile).
FROM node:22-bookworm-slim AS build
# Mirror the repo layout: the app imports ../../demo-api (only used by the GitHub Pages demo build).
WORKDIR /src/frontend/angular-admin
COPY frontend/angular-admin/package.json frontend/angular-admin/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/demo-api/ /src/frontend/demo-api/
COPY frontend/angular-admin/ ./
RUN npx ng build --configuration production

FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY infrastructure/nginx/admin-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/frontend/angular-admin/dist/angular-admin/browser /usr/share/nginx/html/admin
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
