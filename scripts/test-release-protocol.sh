#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
agent_dir="$repo_dir/agent"
bastion_dir="$(cd "$repo_dir/../delivest-bastion/bastion" && pwd)"

: "${TEST_DB_PORT:=55442}"
: "${MIX_TEST_PARTITION:=release_protocol}"
: "${ERL_FLAGS:=+S 4:4}"

export TEST_DB_PORT MIX_TEST_PARTITION ERL_FLAGS

(cd "$agent_dir" && MIX_ENV=test mix compile)

export RELEASE_PROTOCOL_INTEGRATION=1
export RELEASE_AGENT_BEAM_ROOT="$agent_dir/_build/test/lib"

# The agent is pinned to OTP 28; keep Bastion's ordinary OTP 27 build untouched.
if [[ -n "${RELEASE_PROTOCOL_BUILD_PATH:-}" ]]; then
  build_dir="$RELEASE_PROTOCOL_BUILD_PATH"
else
  build_dir="$(mktemp -d /tmp/delivest-release-protocol.XXXXXX)"
  trap 'rm -rf -- "$build_dir"' EXIT
fi

(cd "$bastion_dir" &&
  ASDF_ERLANG_VERSION=28.4.2 \
  ASDF_ELIXIR_VERSION=1.19.5-otp-28 \
  MIX_BUILD_PATH="$build_dir" \
  mix test test/integration/release_protocol_test.exs)
