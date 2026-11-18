# ── NEXORA edge proxy ──
FROM nginx:1.28-alpine
COPY infrastructure/nginx/nginx.conf /etc/nginx/nginx.conf
COPY infrastructure/nginx/proxy_params.conf /etc/nginx/proxy_params.conf
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1/nginx-health || exit 1
