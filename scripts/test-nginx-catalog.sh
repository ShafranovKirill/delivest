#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
name="delivest-catalog-test-$$"
tmp=$(mktemp -d)
cleanup() {
  docker rm -f "$name-client" "$name-server" >/dev/null 2>&1 || true
  docker network rm "$name" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
cat > "$tmp/backend.conf" <<'CONFIG'
map $http_x_original_uri $valid {
  default 403;
  ~^/center/product/exists 204;
  ~^/center/category/exists 204;
}
server {
  listen 4000;
  location = /seo/landing-status { if ($valid = 403) { return 403; } return 204; }
  location = /seo/head { default_type text/html; return 200 '<title>Public product</title>'; }
  location = /seo/content { default_type text/html; return 200 '<section><h1>Product server content</h1></section>'; }
  location = /seo/branches/center/catalog.xml { default_type application/xml; return 200 '<yml_catalog />'; }
}
CONFIG
cat > "$tmp/index.html" <<'HTML'
<!doctype html><html><head><!--# include virtual="/__seo/head" --></head><body><div id="app"><!--# include virtual="/__seo/content" --></div><script src="/app.js"></script></body></html>
HTML
docker network create "$name" >/dev/null
docker run -d --name "$name-server" --network "$name" --network-alias server \
  -v "$tmp/backend.conf:/etc/nginx/conf.d/default.conf:ro" nginx:stable >/dev/null
docker run -d --name "$name-client" --network "$name" \
  -v "$root/nginx.client.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "$tmp/index.html:/usr/share/nginx/html/index.html:ro" \
  -p 127.0.0.1::3000 nginx:stable >/dev/null
port=$(docker port "$name-client" 3000/tcp | sed -n 's/.*://p' | head -1)
base="http://127.0.0.1:$port"
for attempt in {1..30}; do
  if curl -fsS "$base/" -o "$tmp/ordinary" 2>/dev/null; then break; fi
  if ((attempt == 30)); then docker logs "$name-client"; exit 1; fi
  sleep 0.2
done
for path in '/center/product/exists?yclid=untrusted' '/center/category/exists'; do
  curl -fsS "$base$path" -o "$tmp/valid"
  grep -q '<title>Public product</title>' "$tmp/valid"
  grep -q '<h1>Product server content</h1>' "$tmp/valid"
  grep -q '/app.js' "$tmp/valid"
done
status=$(curl -sS "$base/center/product/missing" -o "$tmp/missing" -w '%{http_code}')
[[ "$status" == 404 ]]
grep -q '/app.js' "$tmp/missing"
[[ $(curl -sS "$base/__seo/content" -o /dev/null -w '%{http_code}') == 204 ]]
curl -fsS "$base/catalog/center.xml" | grep -q '<yml_catalog'
logs=$(docker logs "$name-client" 2>&1)
if grep -q 'yclid=untrusted' <<< "$logs"; then
  printf 'Catalog nginx leaked an untrusted identifier into logs.\n' >&2
  exit 1
fi
docker exec "$name-client" nginx -t
printf 'Catalog nginx: canonical product/category HTML + SPA, real 404, internal-only fragments, public feed passed.\n'
