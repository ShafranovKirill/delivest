#!/bin/sh
# Exercise the locations emitted by host-nginx.sh using the pinned gateway nginx,
# without the gateway, application server, or any real backup archive.
set -eu

cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
chmod 755 "$tmp"
mkdir -m 755 "$tmp/public"
cp deploy/backup-status/index.html "$tmp/public/index.html"
cp deploy/backup-status/monitor.js "$tmp/public/monitor.js"
cp deploy/backup-status/monitor.css "$tmp/public/monitor.css"
token=$(printf '%064d' 1)
printf '{"phase":"running","step":"accepted"}' > "$tmp/public/$token.json"
printf '{"updated_at":"2026-11-17T00:00:00Z"}' > "$tmp/public/heartbeat.json"
printf 'must not be served' > "$tmp/public/monitor.token"

# Use the actual functions that host-nginx.sh uses when writing its vhost.
functions=$(sed -n '/^monitor_headers() {/,/^write_http_conf() {/p' deploy/host-nginx.sh | sed '$d')
# Used by the evaluated host-nginx.sh monitor_locations function.
# shellcheck disable=SC2034
MONITOR_DIR=/test/public
eval "$functions"
monitor_locations > "$tmp/locations.conf"
cat > "$tmp/nginx.conf" <<'CONF'
events {}
http {
    include /etc/nginx/mime.types;
    access_log /test/access.log;
    server {
        listen 18080;
        server_name localhost;
        include /test/locations.conf;
        location / { return 502; }
    }
}
CONF

docker run --rm -v "$tmp:/test" \
  nginx:1.28-alpine@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236 \
  sh -eu -c '
    nginx -t -c /test/nginx.conf
    nginx -c /test/nginx.conf
    check() {
      path=$1 expected=$2 type=$3
      headers=$(wget -S -O /dev/null "http://127.0.0.1:18080$path" 2>&1 || true)
      printf "%s\n" "$headers" | grep -q "HTTP/1.1 $expected"
      if [ -n "$type" ]; then
        printf "%s\n" "$headers" | grep -qi "Content-Type: $type"
      fi
      case "$expected" in 200)
        printf "%s\n" "$headers" | grep -qi "Cache-Control: no-store"
        printf "%s\n" "$headers" | grep -qi "Referrer-Policy: no-referrer"
      esac
    }
    token=$(printf "%064d" 1)
    check /_backup-status/ 200 text/html
    check /_backup-status/monitor.js 200 application/javascript
    check /_backup-status/monitor.css 200 text/css
    check /_backup-status/heartbeat.json 200 application/json
    check "/_backup-status/$token.json" 200 application/json
    check /_backup-status/monitor.token 404 ""
    check /_backup-status/not-a-token.json 404 ""
    check / 502 ""
    headers=$(wget -S -O /dev/null --post-data=x http://127.0.0.1:18080/_backup-status/ 2>&1 || true)
    printf "%s\n" "$headers" | grep -q "HTTP/1.1 405"
    if [ -f /test/access.log ] && grep -q "$token" /test/access.log; then
      echo "monitor token leaked to access log" >&2
      exit 1
    fi
  '

echo 'backup monitor nginx routes: ok'
