#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
report_dir="${RUNNER_TEMP:-/tmp}/release-upgrade"
mkdir -p "$report_dir"
report="$report_dir/report.json"
preparation_failed() {
  echo "Upgrade preparation failed; see release-upgrade-result artifact" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
}
trap preparation_failed ERR
if [[ ${1:-} == --prepared-report && $# == 2 ]]; then
  # Local same-version rehearsal only; CI invokes without arguments.
  cp "$2" "$report"
  python3 - "$root" "$report" <<'PYVALIDATE'
import importlib.util, json, sys
root, path = sys.argv[1:]
spec = importlib.util.spec_from_file_location('installer', root + '/scripts/install-release.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)
report = json.load(open(path))
assert report['status'] == 'upgrade_required'
assert report['compatibility'] in ('compatible', 'incompatible')
for name in ('previous', 'candidate'):
    manifest = report[name]
    installer.validate(manifest, manifest['version'])
PYVALIDATE
  VERSION=$(jq -r .candidate.version "$report")
else
  test $# -eq 0
  python3 "$root/scripts/release-upgrade.py" --version "${VERSION:?}" --sha "${SHA:?}" --report "$report"
fi
trap - ERR
if [[ $(jq -r .status "$report") == baseline_only ]]; then
  echo 'No earlier published stable release: baseline_only' | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 0
fi
project="release-upgrade-${GITHUB_RUN_ID:-local}-$$"
env_file=$(mktemp "${RUNNER_TEMP:-/tmp}/release-upgrade-env.XXXXXX")
chmod 600 "$env_file"
cat > "$env_file" <<ENV
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
ENV
set -a
# Only synthetic values written above are sourced.
# shellcheck source=/dev/null
source "$env_file"
set +a
SMOKE_SECRET=$(openssl rand -hex 64)
export SMOKE_SECRET
compose_cmd=(timeout 180 docker compose -p "$project" -f "$root/docker-compose.yml" -f "$root/deploy/ci/release-smoke.yml" -f "$root/deploy/ci/release-upgrade.yml" --env-file "$env_file")
started=false
cleanup() {
  result=$?
  if "$started"; then
    if (( result != 0 )); then
      "${compose_cmd[@]}" ps > "$report_dir/ps.txt" 2>&1 || true
      "${compose_cmd[@]}" logs --tail=60 gateway server client postgres s3 > "$report_dir/logs.txt" 2>&1 || true
    fi
    timeout 60 docker compose -p "$project" -f "$root/docker-compose.yml" -f "$root/deploy/ci/release-smoke.yml" -f "$root/deploy/ci/release-upgrade.yml" --env-file "$env_file" down -v --remove-orphans >/dev/null || true
  fi
  rm -f "$env_file"
  if (( result != 0 )); then
    echo "Upgrade gate failed; see release-upgrade-result artifact" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
    jq --arg error 'container upgrade check failed' '.status="failed" | .error=$error | .container_rollback="not_completed" | .data_restore="not_attempted"' "$report" > "$report.tmp" && mv "$report.tmp" "$report"
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
read_refs() {
  local source=$1
  for variant in server client agent; do
    local digest
    digest=$(jq -r --arg name "$variant" ".$source.images[\$name]" "$report")
    printf -v "${variant^^}_IMAGE" 'ghcr.io/%s-%s@%s' 'shafranovkirill/delivest' "$variant" "$digest"
    export "${variant^^}_IMAGE"
  done
}
wait_ready() {
  for _ in {1..90}; do
    if "${compose_cmd[@]}" exec -T gateway wget -T 5 -qO- --header='Host: api.smoke.local' --header='X-Forwarded-Proto: https' http://127.0.0.1/ready 2>/dev/null | jq -e '.status == "ok"' >/dev/null; then
      return 0
    fi
    sleep 2
  done
  echo 'Upgrade server readiness timed out' >&2
  return 1
}
fixture() {
  "${compose_cmd[@]}" exec -T server bin/delivest rpc "Code.eval_string(File.read!(\"/ci-fixtures/release-upgrade-fixture.exs\"), action: \"$1\", key: \"$2\")"
}
read_refs previous
started=true
"${compose_cmd[@]}" up -d --pull "${RELEASE_UPGRADE_PULL_POLICY:-always}" postgres s3
"${compose_cmd[@]}" up -d --pull "${RELEASE_UPGRADE_PULL_POLICY:-always}" gateway server client
wait_ready
for _ in {1..90}; do
  if "${compose_cmd[@]}" exec -T gateway sh -c 'nc -z s3 8333' >/dev/null 2>&1; then break; fi
  sleep 2
done
"${compose_cmd[@]}" exec -T gateway sh -c 'nc -z s3 8333'
fixture create before
fixture read before
read_refs candidate
"${compose_cmd[@]}" up -d --force-recreate --pull "${RELEASE_UPGRADE_PULL_POLICY:-always}" --no-deps server client
wait_ready
fixture read before
fixture create after
fixture read after
if [[ $(jq -r .compatibility "$report") == compatible ]]; then
  # Run the old binary against the upgraded schema, without applying down migrations.
  read_refs previous
  "${compose_cmd[@]}" up -d --force-recreate --pull "${RELEASE_UPGRADE_PULL_POLICY:-always}" --no-deps server client
  wait_ready
  fixture read before
  fixture read after
  rollback_result=previous_containers_ready_and_data_readable
  read_refs candidate
else
  rollback_result=skipped_requires_data_restore
fi
jq --arg rollback "$rollback_result" '.status="passed" | .container_rollback=$rollback | .data_restore="not_part_of_upgrade_gate"' "$report" > "$report.tmp"
mv "$report.tmp" "$report"
printf 'Upgrade gate passed: %s -> %s; migration changes: %s\n' "$(jq -r .previous.version "$report")" "$VERSION" "$(jq '.migration_changes | length' "$report")" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
