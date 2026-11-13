#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
name="delivest-log-test-$$"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$name" \
  --add-host server:127.0.0.1 --add-host client:127.0.0.1 --add-host s3:127.0.0.1 \
  -e PHX_HOST=api.example.test -e S3_PUBLIC_HOST=media.example.test \
  -e S3_BUCKET=media -e S3_PORT=9000 \
  -v "$root/deploy/nginx/gateway.conf.template:/etc/nginx/templates/default.conf.template:ro" \
  -p 127.0.0.1::80 nginx:stable-alpine >/dev/null
port=$(docker port "$name" 80/tcp | sed -n 's/.*://p' | head -1)
marker="delivest_query_secret_$$"
for attempt in {1..20}; do
  if curl -s -o /dev/null -H 'Host: api.example.test' \
    "http://127.0.0.1:$port/health?token=$marker"; then
    break
  fi
  if (( attempt == 20 )); then exit 1; fi
  sleep 0.2
done
logs=$(docker logs "$name" 2>&1)
grep -q 'GET /health HTTP/' <<< "$logs"
if grep -q "$marker" <<< "$logs"; then
  echo "query marker leaked to nginx logs" >&2
  exit 1
fi
