#!/usr/bin/env bash
set -euo pipefail

mode=${1:?usage: release-images.sh verify|alias}
: "${REPOSITORY:?}" "${SHA:?}" "${VERSION:?}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
test "$(git rev-parse HEAD)" = "$SHA"

digest_of() {
  docker buildx imagetools inspect "$1" | awk '/^Digest:/ {print $2; exit}'
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
  for variant in server client agent; do
    image="ghcr.io/${REPOSITORY}-$variant"
    digest=$(awk '{print $2}' "$variant.digest")
    for tag in "$VERSION" "$MINOR" latest; do
      docker buildx imagetools create -t "$image:$tag" "$image@$digest"
      test "$(digest_of "$image:$tag")" = "$digest"
    done
  done
else
  echo "Unknown mode: $mode" >&2
  exit 2
fi
