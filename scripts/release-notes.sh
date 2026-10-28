#!/bin/sh
set -eu

last=$(git describe --tags --abbrev=0 --match 'v[0-9]*.[0-9]*.[0-9]*' 2>/dev/null || true)
range=${last:+$last..}HEAD

section() {
  lines=$(git log --format=%s "$range" | grep -E "$2" | sed -E 's/^[a-z]+(\([^)]*\))?!?: *//; s/^bump (server|client|agent)(,? (and )?(server|client|agent))* with (the )?//; s/^/- /' || true)
  [ -n "$lines" ] && printf '## %s\n\n%s\n\n' "$1" "$lines"
  return 0
}

section "Новое" '^feat(\([^)]*\))?!?:'
section "Исправления" '^fix(\([^)]*\))?!?:'
section "Прочее" '^(perf|refactor|chore|docs|build|ci|style|test)(\([^)]*\))?!?:'
