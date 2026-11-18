#!/usr/bin/env bash
# Builds the static GitHub Pages demo: the real React app at /<repo>/ and the Angular admin at /<repo>/admin/,
# both answering API calls in the browser with sample data (frontend/demo-api). No backend is involved.
#   bash infrastructure/scripts/build-pages-demo.sh [output-dir] [base-path]
set -euo pipefail
OUT="${1:-_site}"
BASE="${2:-/nexora/}"          # must start and end with a slash
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
case "$OUT" in /*) ;; *) OUT="$ROOT/$OUT" ;; esac

rm -rf "$OUT"
mkdir -p "$OUT"

echo "▸ React app (demo) → $OUT"
( cd "$ROOT/frontend/react-client" && VITE_DEMO=true VITE_BASE="$BASE" npx vite build --outDir "$OUT" --emptyOutDir )

echo "▸ Angular admin (demo) → $OUT/admin"
( cd "$ROOT/frontend/angular-admin" && npx ng build --configuration production,demo --base-href "${BASE}admin/" --output-path "$OUT/admin-build" )
mv "$OUT/admin-build/browser" "$OUT/admin"
rm -rf "$OUT/admin-build"

# GitHub Pages has no SPA fallback. Unknown paths get 404.html, which sends the visitor to the right app
# with the original path in ?p=; each app's index.html restores it before the router starts.
cat > "$OUT/404.html" <<EOF
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>NEXORA</title>
<script>
  (function () {
    var base = '${BASE}';
    var path = location.pathname + location.search + location.hash;
    var app = location.pathname.indexOf(base + 'admin') === 0 ? base + 'admin/' : base;
    location.replace(app + '?p=' + encodeURIComponent(path));
  })();
</script></head><body></body></html>
EOF

RESTORE="<script>(function(){var p=new URLSearchParams(location.search).get('p');if(p&&p.charAt(0)==='/'&&p.charAt(1)!=='/'){history.replaceState(null,'',p);}})();</script>"
for f in "$OUT/index.html" "$OUT/admin/index.html"; do
  python3 - "$f" "$RESTORE" <<'PY'
import sys
path, snippet = sys.argv[1], sys.argv[2]
html = open(path, encoding='utf-8').read()
assert '<head>' in html, path
open(path, 'w', encoding='utf-8').write(html.replace('<head>', '<head>' + snippet, 1))
PY
done
touch "$OUT/.nojekyll"
echo "✓ Demo site ready in $OUT"
