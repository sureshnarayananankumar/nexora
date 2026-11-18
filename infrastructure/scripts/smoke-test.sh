#!/usr/bin/env bash
# End-to-end smoke test against a running stack (used by CI; works locally too).
#   ./infrastructure/scripts/smoke-test.sh http://localhost:8088
set -euo pipefail
BASE="${1:-http://localhost:8088}"
PASS="${NEXORA_DEMO_PASSWORD:-$(grep -E '^NEXORA_DEMO_PASSWORD=' .env | cut -d= -f2-)}"
jar=$(mktemp)
fail() { echo "✗ $1"; exit 1; }
ok() { echo "✓ $1"; }

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

[ "$(code "$BASE/")" = 200 ] && ok "React app served" || fail "React app"
[ "$(code "$BASE/admin/")" = 200 ] && ok "Angular admin served" || fail "Angular admin"
[ "$(code "$BASE/api/v1/public/config")" = 200 ] && ok "API reachable through Nginx" || fail "API"
[ "$(code "$BASE/api/v1/projects")" = 401 ] && ok "API rejects anonymous calls" || fail "auth"

# Demo data is seeded asynchronously after startup; retry login for up to 60 s.
for i in $(seq 1 30); do
  login=$(curl -s -c "$jar" -H 'Content-Type: application/json' -d "{\"email\":\"sarah@acme.dev\",\"password\":\"$PASS\"}" "$BASE/api/v1/auth/login") || true
  token=$(echo "$login" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
  [ -n "$token" ] && break
  sleep 2
done
[ -n "${token:-}" ] && ok "Demo user can log in" || fail "login: $login"

projects=$(curl -s -H "Authorization: Bearer $token" "$BASE/api/v1/projects")
echo "$projects" | grep -q '"key":"ATL"' && ok "Projects API returns seeded data" || fail "projects: $projects"

pid=$(echo "$projects" | sed -n 's/.*"id":\([0-9]*\),"key":"ATL".*/\1/p')
health=$(curl -s -H "Authorization: Bearer $token" "$BASE/api/v1/projects/$pid/insights/health")
echo "$health" | grep -q '"score"' && ok "Insights engine computes health" || fail "health: $health"

created=$(curl -s -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d '{"title":"Smoke test task","priority":"LOW"}' "$BASE/api/v1/projects/$pid/tasks")
echo "$created" | grep -q '"key":"ATL-' && ok "Task created" || fail "create task: $created"

[ "$(code -X POST -b "$jar" "$BASE/api/v1/auth/refresh")" = 200 ] && ok "Refresh cookie rotates" || fail "refresh"
[ "$(code "$BASE/socket.io/?EIO=4&transport=polling")" = 200 ] && ok "Socket.IO reachable through Nginx" || fail "socket.io"
[ "$(code -H "Authorization: Bearer $token" "$BASE/api/v1/admin/overview")" = 403 ] && ok "Admin API forbidden for org users" || fail "rbac"

rm -f "$jar"
echo "All smoke checks passed."
