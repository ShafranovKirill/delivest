#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != '--run' || $# -ne 1 ]]; then
  echo "usage: DRILL_SERVER_IMAGE=<image> DRILL_REPORT_DIR=<directory> $0 --run" >&2
  exit 2
fi

for tool in docker mix python3 timeout openssl; do
  command -v "$tool" >/dev/null || { echo "missing required tool: $tool" >&2; exit 2; }
done
: "${DRILL_SERVER_IMAGE:?set DRILL_SERVER_IMAGE to the server image under test}"
docker info >/dev/null
repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
work=$(mktemp -d "${RUNNER_TEMP:-/tmp}/delivest-restore-drill.XXXXXX")
project="restore-drill-$(basename "$work" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')"
compose="$work/compose.yml"
archive="$work/full.tar"
report_dir=${DRILL_REPORT_DIR:-"${RUNNER_TEMP:-/tmp}/restore-drill-report"}
mkdir -p "$report_dir"
started_at=$(date +%s)
phase=preparing
backup_seconds=0
restore_seconds=0
data_restore=not_run
container_rollback=not_run
pre_backup_check=pending
post_backup_check=pending
restored_check=pending
failure=''

# The only persistent output is a report and, on failure, synthetic-container logs.
cleanup() {
  local status=$?
  trap - EXIT
  if (( status != 0 )); then
    failure="failed during $phase (exit $status)"
    if [[ "$phase" == exporting_backup && -n "${step_start:-}" ]]; then backup_seconds=$(( $(date +%s) - step_start )); fi
    if [[ "$phase" == restoring_data && -n "${step_start:-}" ]]; then restore_seconds=$(( $(date +%s) - step_start )); fi
    if [[ "$phase" == restoring_data || "$phase" == verifying_restore ]]; then data_restore=failed; fi
    { dc ps; dc logs --tail=80; } > "$report_dir/compose.log" 2>&1 || true
  fi
  REPORT_STATUS=$status REPORT_FAILURE="$failure" REPORT_PHASE=$phase \
  REPORT_BACKUP_SECONDS=$backup_seconds REPORT_RESTORE_SECONDS=$restore_seconds \
  REPORT_TOTAL_SECONDS=$(( $(date +%s) - started_at )) \
  REPORT_DATA_RESTORE=$data_restore REPORT_CONTAINER_ROLLBACK=$container_rollback \
  REPORT_PRE_CHECK="$pre_backup_check" REPORT_POST_CHECK="$post_backup_check" \
  REPORT_RESTORED_CHECK="$restored_check" \
  REPORT_IMAGE="$DRILL_SERVER_IMAGE" REPORT_OUTPUT="$report_dir/report.json" python3 - <<'PY'
import json, os
from pathlib import Path
p = Path(os.environ['REPORT_OUTPUT'])
p.write_text(json.dumps({
  'status': 'passed' if os.environ['REPORT_STATUS'] == '0' else 'failed',
  'phase': os.environ['REPORT_PHASE'],
  'failure': os.environ['REPORT_FAILURE'] or None,
  'server_image': os.environ['REPORT_IMAGE'],
  'backup_seconds': int(os.environ['REPORT_BACKUP_SECONDS']),
  'restore_seconds': int(os.environ['REPORT_RESTORE_SECONDS']),
  'total_seconds': int(os.environ['REPORT_TOTAL_SECONDS']),
  'container_rollback': os.environ['REPORT_CONTAINER_ROLLBACK'],
  'data_restore': os.environ['REPORT_DATA_RESTORE'],
  'checks': {
    'pre_backup_order_and_object': os.environ['REPORT_PRE_CHECK'],
    'post_backup_order_absent_after_restore': os.environ['REPORT_POST_CHECK'],
    'restored_order_and_object_bytes': os.environ['REPORT_RESTORED_CHECK']
  }
}, indent=2) + '\n')
PY
  timeout 60 docker compose -p "$project" -f "$compose" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$work"
  if (( status != 0 )); then echo "restore drill failed; report: $report_dir/report.json" >&2; fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

dc() { timeout 180 docker compose -p "$project" -f "$compose" "$@"; }
export DRILL_SERVER_IMAGE
export DRILL_SECRET
DRILL_SECRET=$(openssl rand -hex 64)
export DRILL_FIXTURES="$repo/scripts"
cat > "$compose" <<'YAML'
services:
  postgres:
    image: postgres:16-alpine@sha256:0cefaabd882e42bcb2a2f3dc56d3ce4770560ba62fd7f197f1a2e008fd5731ab
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
    volumes:
      - s3_data:/data
  server:
    image: ${DRILL_SERVER_IMAGE:?}
    environment:
      PHX_SERVER: "true"
      PHX_HOST: api.restore.local
      SECRET_KEY_BASE: ${DRILL_SECRET:?}
      DATABASE_URL: ecto://drill:drill-local-only@postgres/drill
      S3_ACCESS_KEY: drillAccess
      S3_SECRET_KEY: drillSecretLocalOnly
      S3_HOST: s3
      S3_PUBLIC_HOST: s3
      S3_SCHEME: http://
      S3_PORT: "8333"
      S3_PORT_EXTERNAL: "8333"
      S3_BUCKET: drill-public
      S3_PRIVATE_BUCKET: drill-private
      CLIENT_ORIGIN: http://shop.restore.local
    volumes:
      - ${DRILL_FIXTURES:?}:/ci-fixtures:ro
    depends_on:
      - postgres
      - s3
volumes:
  postgres_data:
  s3_data:
YAML

phase=starting
# All resources belong to this unique Compose project; no host or production volumes are mounted.
timeout 300 docker compose -p "$project" -f "$compose" up -d --pull missing postgres s3
for _ in {1..60}; do
  if dc exec -T postgres pg_isready -U drill -d drill >/dev/null 2>&1; then break; fi
  sleep 1
done
dc exec -T postgres pg_isready -U drill -d drill >/dev/null
timeout 300 docker compose -p "$project" -f "$compose" up -d --pull missing server
wait_server() {
  for _ in {1..120}; do
    if [[ "$(dc ps --status running --services | sort)" == "$(printf '%s\n' postgres s3 server | sort)" ]] &&
       dc exec -T postgres psql -U drill -d drill -Atqc "SELECT count(*) FROM schema_migrations" 2>/dev/null | grep -Eq '^[1-9][0-9]*$' &&
       timeout 10 docker compose -p "$project" -f "$compose" exec -T server bin/delivest rpc 'Delivest.Repo.query!("SELECT 1")' >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo 'server readiness timed out' >&2
  return 1
}
wait_server

fixture() {
  local action=$1 key=$2
  timeout 90 docker compose -p "$project" -f "$compose" exec -T server env -u PHX_SERVER bin/delivest eval \
    'Code.eval_file("/ci-fixtures/release-upgrade-fixture.exs")' -- "$action" "$key"
}
phase=creating_control_order
fixture create before
fixture read before
pre_backup_check=passed

run_backup() {
  local action=$1 source=$2
  (cd "$repo/agent" &&
    DRILL_PROJECT_DIR="$work" DRILL_PROJECT_NAME="$project" DRILL_COMPOSE_FILE="$compose" \
    DRILL_ACTION="$action" DRILL_ARCHIVE="$source" S3_PRIVATE_BUCKET=drill-private \
    MIX_ENV=dev timeout 900 mix run -e '
      p = %DelivestAgent.Project{name: System.fetch_env!("DRILL_PROJECT_NAME"), dir: System.fetch_env!("DRILL_PROJECT_DIR"), files: [System.fetch_env!("DRILL_COMPOSE_FILE")], agent_service: "agent"}
      archive = System.fetch_env!("DRILL_ARCHIVE")
      result = case System.fetch_env!("DRILL_ACTION") do
        "export" -> DelivestAgent.FullBackup.export(p, archive)
        "import" -> DelivestAgent.FullBackup.import(p, archive, replace: true)
      end
      IO.inspect(result, label: "full backup result")
      unless match?({:ok, _}, result), do: System.halt(1)
    ')
}

phase=exporting_backup
step_start=$(date +%s)
run_backup export "$archive"
backup_seconds=$(( $(date +%s) - step_start ))
# FullBackup stops and restarts the application itself; no app_stopped override is used.
phase=creating_post_backup_order
wait_server
fixture create after
fixture read after
phase=restoring_data
step_start=$(date +%s)
run_backup import "$archive"
restore_seconds=$(( $(date +%s) - step_start ))
phase=verifying_restore
wait_server
fixture read before
restored_check=passed
fixture assert_absent after
post_backup_check=passed
data_restore=passed
phase=complete
echo "restore verified: control order and linked object bytes; post-backup order absent"
echo "backup=${backup_seconds}s restore=${restore_seconds}s total=$(( $(date +%s) - started_at ))s"
