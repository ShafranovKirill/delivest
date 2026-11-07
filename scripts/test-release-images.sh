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
export VERSION=1.2.3 MINOR=1.2
digest="sha256:$(printf 'a%.0s' {1..64})"
mkdir "$tmp/bin"
cat > "$tmp/bin/docker" <<'SH'
#!/usr/bin/env bash
if [[ $1 == buildx && $2 == imagetools && $3 == inspect ]]; then
  printf 'Digest: %s\n' "$EXPECTED_DIGEST"
elif [[ $1 == buildx && $2 == imagetools && $3 == create ]]; then
  printf 'create\n' >> "$CALLS"
else
  exit 2
fi
SH
chmod +x "$tmp/bin/docker"
export PATH="$tmp/bin:$PATH" EXPECTED_DIGEST="$digest" CALLS="$tmp/calls"
cd "$tmp"
for variant in server client agent; do
  printf '%s %s\n' "$variant" "$digest" > "$variant.digest"
done
"$root/scripts/release-images.sh" verify
jq -e --arg digest "$digest" '.images.server == $digest and .images.client == $digest and .images.agent == $digest' release-manifest.json >/dev/null
"$root/scripts/release-images.sh" alias
test "$(wc -l < "$CALLS")" -eq 9
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
