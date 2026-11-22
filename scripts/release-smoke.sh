#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
compose="$root/deploy/ci/release-smoke.yml"
project="release-smoke-${GITHUB_RUN_ID:-local}-$$"
smoke_env=$(mktemp "${RUNNER_TEMP:-/tmp}/release-smoke-env.XXXXXX")
compose_cmd=(docker compose -p "$project" -f "$root/docker-compose.yml" -f "$compose" --env-file "$smoke_env")
stack_started=false
cleanup() {
  result=$?
  if "$stack_started"; then
    if (( result != 0 )); then
      mkdir -p "${RUNNER_TEMP:-/tmp}/release-smoke-diagnostics"
      "${compose_cmd[@]}" ps > "${RUNNER_TEMP:-/tmp}/release-smoke-diagnostics/ps.txt" 2>&1 || true
      "${compose_cmd[@]}" logs --tail=60 gateway server client postgres s3 agent > "${RUNNER_TEMP:-/tmp}/release-smoke-diagnostics/logs.txt" 2>&1 || true
    fi
    "${compose_cmd[@]}" down -v --remove-orphans >/dev/null || true
  fi
  rm -f "$smoke_env"
  exit "$result"
}
trap cleanup EXIT
chmod 600 "$smoke_env"
cat > "$smoke_env" <<EOF
COMPOSE_PROJECT_NAME=$project
PHX_HOST=api.smoke.local
S3_PUBLIC_HOST=s3.smoke.local
S3_BUCKET=delivest
S3_PORT=8333
DB_USER=smoke
DB_PASSWORD=smoke
DB_NAME=smoke
DB_HOST=postgres
VITE_API_BASE_URL=http://api.smoke.local
CLIENT_ORIGIN=http://shop.smoke.local
S3_ACCESS_KEY=smoke
S3_SECRET_KEY=smoke-secret
EOF
set -a
# All interpolated Compose values come from this synthetic environment.
# shellcheck source=/dev/null
source "$smoke_env"
set +a
export SMOKE_SECRET
SMOKE_SECRET=$(openssl rand -hex 64)

for variant in server client agent; do
  read -r recorded digest < "${DIGEST_DIR:-.}/$variant.digest"
  test "$recorded" = "$variant"
  [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]]
  printf -v "${variant^^}_IMAGE" 'ghcr.io/%s-%s@%s' "$REPOSITORY" "$variant" "$digest"
  export "${variant^^}_IMAGE"
done

if [[ ${SMOKE_SKIP_CANDIDATE_VERIFY:-0} != 1 ]]; then
  "$root/scripts/release-images.sh" verify
fi

stack_started=true
"${compose_cmd[@]}" up -d --pull "${SMOKE_PULL_POLICY:-always}" postgres s3
for attempt in {1..30}; do
  if "${compose_cmd[@]}" exec -T postgres pg_isready -U smoke -d smoke >/dev/null 2>&1; then
    break
  fi
  if (( attempt == 30 )); then
    echo 'Postgres readiness timed out' >&2
    exit 1
  fi
  sleep 2
done
"${compose_cmd[@]}" up -d --pull "${SMOKE_PULL_POLICY:-always}"
for attempt in {1..90}; do
  if "${compose_cmd[@]}" exec -T gateway wget -qO- --header='Host: api.smoke.local' --header='X-Forwarded-Proto: https' http://127.0.0.1/ready 2>/dev/null | jq -e '.status == "ok"' >/dev/null; then
    break
  fi
  if (( attempt == 90 )); then
    echo 'Server readiness timed out' >&2
    exit 1
  fi
  sleep 2
done

html=$("${compose_cmd[@]}" exec -T gateway wget -qO- --header='Host: shop.smoke.local' http://127.0.0.1/)
[[ "$html" == *'id="app"'* ]]
asset=$(printf '%s' "$html" | sed -nE 's/.*src="(\/assets\/[^" ]+\.js)".*/\1/p' | head -1)
test -n "$asset"
javascript=$("${compose_cmd[@]}" exec -T gateway wget -qO- --header='Host: shop.smoke.local' "http://127.0.0.1$asset")
test "${#javascript}" -gt 100
headers=$("${compose_cmd[@]}" exec -T gateway wget -S -O /dev/null --header='Host: shop.smoke.local' "http://127.0.0.1$asset" 2>&1)
grep -qi 'Content-Type:.*javascript' <<< "$headers"
runtime_config=$("${compose_cmd[@]}" exec -T gateway wget -qO- --header='Host: shop.smoke.local' http://127.0.0.1/env-config.js)
[[ "$runtime_config" == *'http://api.smoke.local'* ]]
"${compose_cmd[@]}" exec -T gateway wget -qO- --header='Host: api.smoke.local' --header='X-Forwarded-Proto: https' http://127.0.0.1/health >/dev/null
"${compose_cmd[@]}" exec -T gateway wget -qO- --header='Host: api.smoke.local' --header='X-Forwarded-Proto: https' 'http://127.0.0.1/client/storefront/v1/bootstrap?locale=ru' |
  jq -e '(.schema_version == 1) and (.branches | type == "array") and (.branches | length == 0) and (.selected_branch == null) and (.menu == null)' >/dev/null
test "$("${compose_cmd[@]}" ps --status running --services | sort)" = "$(printf '%s\n' agent client gateway postgres s3 server | sort)"
"${compose_cmd[@]}" exec -T agent docker --version
"${compose_cmd[@]}" exec -T agent docker compose version
