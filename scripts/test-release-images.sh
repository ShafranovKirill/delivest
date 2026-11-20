#!/usr/bin/env bash
set -euo pipefail
root=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export GIT_DIR
GIT_DIR=$(git -C "$root" rev-parse --absolute-git-dir)
export GIT_WORK_TREE="$root"
export REPOSITORY=example/delivest SHA
SHA=$(git -C "$root" rev-parse HEAD)
export VERSION=99.2.3 MINOR=99.2
digest="sha256:$(printf 'a%.0s' {1..64})"
mkdir "$tmp/bin"
cat > "$tmp/bin/docker" <<'SH'
#!/usr/bin/env bash
if [[ $1 == buildx && $2 == imagetools && $3 == inspect ]]; then
  if [[ $4 == *:99.2.3 && ${INSPECT_FAIL_VERSION:-0} == 1 ]]; then
    printf 'registry unavailable\n' >&2
    exit 42
  fi
  if [[ $4 == *:99.2.3 && ${VERSION_EXISTS:-0} != 1 ]] && ! grep -Fqx "$4" "$CALLS" 2>/dev/null; then
    printf 'manifest unknown\n' >&2
    exit 1
  fi
  if [[ ${INSPECT_FAIL:-} == 1 ]]; then
    printf 'inspect failed\n' >&2
    exit 42
  fi
  if [[ ${INSPECT_NO_DIGEST:-} != 1 ]]; then
    if [[ $4 == *:99.2.3 && ${VERSION_DIGEST_MISMATCH:-0} == 1 ]]; then
      printf 'Digest: sha256:%064d\n' 0
    else
      printf 'Digest: %s\n' "$EXPECTED_DIGEST"
    fi
  fi
  if [[ ${INSPECT_TAIL_BYTES:-0} -gt 0 ]]; then
    head -c "$INSPECT_TAIL_BYTES" /dev/zero | tr '\0' x
  fi
elif [[ $1 == buildx && $2 == imagetools && $3 == create ]]; then
  printf '%s\n' "$5" >> "$CALLS"
  if [[ ${CREATE_FAIL_AFTER:-0} -gt 0 && $(wc -l < "$CALLS") -eq $CREATE_FAIL_AFTER && ! -e $FAILED_ONCE ]]; then
    touch "$FAILED_ONCE"
    exit 42
  fi
else
  exit 2
fi
SH
cat > "$tmp/bin/gh" <<'SH'
#!/usr/bin/env bash
if [[ $1 == release && $2 == view ]]; then
  if [[ ${RELEASE_UNAVAILABLE:-0} == 1 ]]; then printf 'TLS timeout\n' >&2; exit 42; fi
  if [[ ${RELEASE_EXISTS:-0} == 1 ]]; then exit 0; fi
  printf 'HTTP 404\n' >&2
  exit 1
elif [[ $1 == release && $2 == download ]]; then
  cp "$PUBLISHED_MANIFEST" "${@: -1}"
else
  exit 2
fi
SH
chmod +x "$tmp/bin/docker"
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH" EXPECTED_DIGEST="$digest" CALLS="$tmp/calls" FAILED_ONCE="$tmp/failed-once"
cd "$tmp"
for variant in server client agent; do
  printf '%s %s\n' "$variant" "$digest" > "$variant.digest"
done
"$root/scripts/release-images.sh" verify
jq -e --arg digest "$digest" '.images.server == $digest and .images.client == $digest and .images.agent == $digest' release-manifest.json >/dev/null
INSPECT_TAIL_BYTES=8388608 "$root/scripts/release-images.sh" verify
for failure in INSPECT_FAIL INSPECT_NO_DIGEST; do
  if env "$failure=1" "$root/scripts/release-images.sh" alias; then exit 1; fi
  test ! -e "$CALLS"
done
for failure in INSPECT_FAIL_VERSION RELEASE_UNAVAILABLE; do
  if env "$failure=1" "$root/scripts/release-images.sh" alias; then exit 1; fi
  test ! -e "$CALLS"
done
if VERSION_EXISTS=1 VERSION_DIGEST_MISMATCH=1 "$root/scripts/release-images.sh" alias; then exit 1; fi
test ! -e "$CALLS"
if CREATE_FAIL_AFTER=3 "$root/scripts/release-images.sh" alias; then exit 1; fi
test "$(wc -l < "$CALLS")" -eq 3
"$root/scripts/release-images.sh" alias
test "$(wc -l < "$CALLS")" -eq 11
cp release-manifest.json "$tmp/published.json"
export PUBLISHED_MANIFEST="$tmp/published.json"
VERSION_EXISTS=1 RELEASE_EXISTS=1 "$root/scripts/release-images.sh" alias
test "$(wc -l < "$CALLS")" -eq 17
printf '{}\n' > "$tmp/published.json"
if VERSION_EXISTS=1 RELEASE_EXISTS=1 "$root/scripts/release-images.sh" alias; then exit 1; fi
test "$(wc -l < "$CALLS")" -eq 17
rm "$CALLS" agent.digest
if "$root/scripts/release-images.sh" alias; then exit 1; fi
test ! -e "$CALLS"
printf '%s %s\n' agent 'sha256:invalid' > agent.digest
if "$root/scripts/release-images.sh" verify; then exit 1; fi
printf '%s %s\n' agent "$digest" > agent.digest
EXPECTED_DIGEST="sha256:$(printf 'b%.0s' {1..64})"
export EXPECTED_DIGEST
if "$root/scripts/release-images.sh" alias; then exit 1; fi
test ! -e "$CALLS"
