#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != "--run" || $# -ne 1 ]]; then
  echo "usage: $0 --run (isolated Docker Compose backup/restore drill)" >&2
  exit 2
fi

for tool in docker aws curl mix cmp awk; do
  command -v "$tool" >/dev/null || { echo "missing required tool: $tool" >&2; exit 2; }
done
docker info >/dev/null
docker image inspect postgres:16-alpine >/dev/null
docker image inspect chrislusf/seaweedfs:4.50@sha256:c2658820e763294a9e9de7b36c81e59b879e3459148351aee4e31a126ca64860 >/dev/null

repo=$(cd "$(dirname "$0")/.." && pwd)
started_at=$(date +%s)
work=$(mktemp -d /tmp/delivest-s5-drill.XXXXXX)
project="delivest_s5_drill_$(basename "$work" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')"
compose="$work/compose.yml"
archive="$work/full.tar"

cleanup() {
  local status=$?
  if [[ $status -ne 0 ]]; then
    local evidence="/tmp/delivest-s5-drill-failure-$(basename "$work").log"
    { dc ps; dc logs --tail 100; } > "$evidence" 2>&1 || true
    echo "drill failed; Compose evidence: $evidence" >&2
  fi
  docker compose -p "$project" -f "$compose" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

cat > "$compose" <<'YAML'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: drill
      POSTGRES_PASSWORD: drill-local-only
      POSTGRES_DB: drill
    volumes:
      - postgres_data:/var/lib/postgresql/data
  s3:
    image: chrislusf/seaweedfs:4.50@sha256:c2658820e763294a9e9de7b36c81e59b879e3459148351aee4e31a126ca64860
    entrypoint:
      - sh
      - -c
      - |
        mkdir -p /etc/seaweedfs
        printf '%s\n' '{"identities":[{"name":"drill","credentials":[{"accessKey":"drillAccess","secretKey":"drillSecretLocalOnly"}],"actions":["Admin","Read","List","Tagging","Write"]}]}' > /etc/seaweedfs/s3.json
        exec weed server -s3 -s3.port=8333 -s3.config=/etc/seaweedfs/s3.json -dir=/data
    environment:
      S3_BUCKET: drill-public
    ports:
      - "127.0.0.1::8333"
    volumes:
      - s3_data:/data
volumes:
  postgres_data:
  s3_data:
YAML

dc() { docker compose -p "$project" -f "$compose" "$@"; }
echo "drill project=$project work=$work"
dc up -d --pull never

for _ in {1..60}; do
  if dc exec -T postgres pg_isready -U drill -d drill >/dev/null 2>&1; then break; fi
  sleep 1
done
dc exec -T postgres pg_isready -U drill -d drill

export AWS_ACCESS_KEY_ID=drillAccess AWS_SECRET_ACCESS_KEY=drillSecretLocalOnly AWS_DEFAULT_REGION=us-east-1 AWS_MAX_ATTEMPTS=1
s3() {
  local current_port
  current_port=$(dc port s3 8333 | tail -1 | awk -F: '{print $NF}')
  aws --endpoint-url "http://127.0.0.1:$current_port" --cli-connect-timeout 2 --cli-read-timeout 5 "$@"
}
wait_s3() {
  for _ in {1..60}; do
    if s3 s3api list-buckets >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo 'S3 did not become ready' >&2
  dc ps >&2
  dc logs s3 --tail 80 >&2
  return 1
}
wait_object_equals() {
  local bucket=$1 expected=$2 observed
  observed="$work/observed-$(basename "$expected")"
  for _ in {1..30}; do
    if s3 s3 cp "s3://$bucket/fixture.txt" "$observed" >/dev/null 2>&1 &&
      cmp -s "$expected" "$observed"; then return 0; fi
    sleep 1
  done
  echo "S3 object $bucket/fixture.txt did not match $expected" >&2
  return 1
}
wait_s3
s3 s3api create-bucket --bucket drill-public >/dev/null
s3 s3api create-bucket --bucket drill-private >/dev/null
printf 'public-before\n' > "$work/public-before"
printf 'private-before\n' > "$work/private-before"
s3 s3 cp "$work/public-before" s3://drill-public/fixture.txt >/dev/null
s3 s3 cp "$work/private-before" s3://drill-private/fixture.txt >/dev/null

dc exec -T postgres psql -U drill -d drill -v ON_ERROR_STOP=1 -c 'CREATE TABLE schema_migrations (version bigint PRIMARY KEY); INSERT INTO schema_migrations VALUES (20261107000000); CREATE TABLE drill_payload (value text NOT NULL); INSERT INTO drill_payload VALUES ('"'"'before'"'"');' >/dev/null

run_backup() {
  local action=$1 source=$2
  local started status
  started=$(date +%s)
  if (cd "$repo/agent" &&
    DRILL_PROJECT_DIR="$work" DRILL_PROJECT_NAME="$project" DRILL_COMPOSE_FILE="$compose" \
    DRILL_ACTION="$action" DRILL_ARCHIVE="$source" S3_PRIVATE_BUCKET=drill-private \
    MIX_ENV=dev mix run -e '
      p = %DelivestAgent.Project{name: System.fetch_env!("DRILL_PROJECT_NAME"), dir: System.fetch_env!("DRILL_PROJECT_DIR"), files: [System.fetch_env!("DRILL_COMPOSE_FILE")], agent_service: "agent"}
      archive = System.fetch_env!("DRILL_ARCHIVE")
      result = case System.fetch_env!("DRILL_ACTION") do
        "export" -> DelivestAgent.FullBackup.export(p, archive, app_stopped: true)
        "import" -> DelivestAgent.FullBackup.import(p, archive, replace: true, app_stopped: true)
      end
      IO.inspect(result, label: "full backup result")
      unless match?({:ok, _}, result), do: System.halt(1)
    '); then status=0; else status=$?; fi
  echo "backup $action duration=$(( $(date +%s) - started ))s exit=$status"
  return "$status"
}

run_backup export "$archive"
wait_s3
dc exec -T postgres psql -U drill -d drill -v ON_ERROR_STOP=1 -c "UPDATE drill_payload SET value = 'mutated';" >/dev/null
printf 'public-mutated\n' > "$work/public-mutated"
printf 'private-mutated\n' > "$work/private-mutated"
s3 s3 cp "$work/public-mutated" s3://drill-public/fixture.txt >/dev/null
s3 s3 cp "$work/private-mutated" s3://drill-private/fixture.txt >/dev/null
wait_object_equals drill-public "$work/public-mutated"
wait_object_equals drill-private "$work/private-mutated"

run_backup import "$archive"
wait_s3
[[ "$(dc exec -T postgres psql -U drill -d drill -Atqc 'SELECT value FROM drill_payload')" == before ]]
s3 s3 cp s3://drill-public/fixture.txt "$work/public-restored" >/dev/null
s3 s3 cp s3://drill-private/fixture.txt "$work/private-restored" >/dev/null
cmp "$work/public-before" "$work/public-restored"
cmp "$work/private-before" "$work/private-restored"
echo 'restore verified: DB and public/private object bytes'

dc exec -T postgres psql -U drill -d drill -v ON_ERROR_STOP=1 -c "UPDATE drill_payload SET value = 'guard';" >/dev/null
printf 'public-guard\n' > "$work/public-guard"
s3 s3 cp "$work/public-guard" s3://drill-public/fixture.txt >/dev/null
wait_object_equals drill-public "$work/public-guard"
cp "$archive" "$work/corrupt.tar"
printf x >> "$work/corrupt.tar"
if run_backup import "$work/corrupt.tar" > "$work/corrupt-result.log" 2>&1; then
  cat "$work/corrupt-result.log"
  echo 'corrupt archive was accepted' >&2
  exit 1
fi
cat "$work/corrupt-result.log"
if ! grep -Fq 'full backup result: {:error, {1, "trailing tar data"}}' "$work/corrupt-result.log"; then
  echo 'corrupt import failed for an unexpected reason' >&2
  exit 1
fi
[[ "$(dc exec -T postgres psql -U drill -d drill -Atqc 'SELECT value FROM drill_payload')" == guard ]]
s3 s3 cp s3://drill-public/fixture.txt "$work/public-guard-after" >/dev/null
cmp "$work/public-guard" "$work/public-guard-after"
echo 'corrupt archive rejected without changing target DB/object'
echo "drill total duration=$(( $(date +%s) - started_at ))s"
