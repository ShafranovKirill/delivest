#!/usr/bin/env bash
set -euo pipefail

mode=${1:?usage: release-images.sh verify|alias}
: "${REPOSITORY:?}" "${SHA:?}" "${VERSION:?}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
test "$(git rev-parse HEAD)" = "$SHA"

digest_of() {
  # Read all output so inspect cannot fail with SIGPIPE under pipefail.
  docker buildx imagetools inspect "$1" | awk '/^Digest:/ && !found {digest = $2; found = 1} END {if (found) print digest; else exit 1}'
}

existing_digest() {
  local output
  if ! output=$(docker buildx imagetools inspect "$1" 2>&1); then
    if [[ "$output" == *"manifest unknown"* || "$output" == *"not found"* ]]; then
      return 0
    fi
    echo "$output" >&2
    return 1
  fi
  awk '/^Digest:/ && !found {digest = $2; found = 1} END {if (found) print digest; else exit 1}' <<< "$output"
}

same_manifest() {
  local expected actual
  expected=$(mktemp)
  actual=$(mktemp)
  if ! jq -e -S . release-manifest.json > "$expected" ||
     ! jq -e -S . "$1" > "$actual" ||
     ! cmp -s "$expected" "$actual"; then
    rm -f "$expected" "$actual"
    return 1
  fi
  rm -f "$expected" "$actual"
}

for variant in server client agent; do
  file="$variant.digest"
  test -f "$file"
  read -r recorded_variant digest < "$file"
  test "$recorded_variant" = "$variant"
  [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]]
  image="ghcr.io/${REPOSITORY}-$variant"
  actual=$(digest_of "$image:candidate-$SHA")
  test "$actual" = "$digest"
done

if [ "$mode" = verify ]; then
  jq -n \
    --arg sha "$SHA" --arg version "$VERSION" \
    --arg server "$(awk '{print $2}' server.digest)" \
    --arg client "$(awk '{print $2}' client.digest)" \
    --arg agent "$(awk '{print $2}' agent.digest)" \
    --arg server_commit "$(git rev-parse HEAD:server)" \
    --arg client_commit "$(git rev-parse HEAD:client)" \
    --arg agent_commit "$(git rev-parse HEAD:agent)" \
    '{root_sha:$sha,version:$version,gitlinks:{server:$server_commit,client:$client_commit,agent:$agent_commit},images:{server:$server,client:$client,agent:$agent}}' > release-manifest.json
elif [ "$mode" = alias ]; then
  : "${MINOR:?}"
  [[ "$MINOR" =~ ^[0-9]+\.[0-9]+$ ]]
  # Validate every immutable version alias before changing any registry tag.
  for variant in server client agent; do
    image="ghcr.io/${REPOSITORY}-$variant"
    digest=$(awk '{print $2}' "$variant.digest")
    existing=$(existing_digest "$image:$VERSION")
    if [[ -n "$existing" && "$existing" != "$digest" ]]; then
      echo "Published $image:$VERSION has a different digest" >&2
      exit 1
    fi
  done
  release_error=$(mktemp)
  trap 'rm -f "$release_error"' EXIT
  if gh release view "v$VERSION" >/dev/null 2>"$release_error"; then
    existing_manifest=$(mktemp)
    trap 'rm -f "$existing_manifest" "$release_error"' EXIT
    gh release download "v$VERSION" -p release-manifest.json -O "$existing_manifest"
    if ! same_manifest "$existing_manifest"; then
      echo "Published v$VERSION has a different manifest" >&2
      exit 1
    fi
  elif ! grep -Eq 'HTTP 404|release not found|Release not found' "$release_error"; then
    cat "$release_error" >&2
    exit 1
  fi
  existing_tag=$(git rev-parse -q --verify "refs/tags/v$VERSION^{commit}" 2>/dev/null || true)
  if [[ -n "$existing_tag" && "$existing_tag" != "$SHA" ]]; then
    echo "Git tag v$VERSION points to a different commit" >&2
    exit 1
  fi
  for variant in server client agent; do
    image="ghcr.io/${REPOSITORY}-$variant"
    digest=$(awk '{print $2}' "$variant.digest")
    for tag in "$VERSION" "$MINOR" latest; do
      if [[ "$tag" == "$VERSION" && "$(existing_digest "$image:$tag")" == "$digest" ]]; then
        continue
      fi
      docker buildx imagetools create -t "$image:$tag" "$image@$digest"
      test "$(digest_of "$image:$tag")" = "$digest"
    done
  done
else
  echo "Unknown mode: $mode" >&2
  exit 2
fi
