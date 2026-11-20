#!/bin/sh
set -eu

echo "Generating runtime environment config..."

api_base_url=${VITE_API_BASE_URL:-https://delivest-server.shafranov.tech}
API_BASE_URL="$api_base_url" awk '
function quote(value,    out, i, j, c) {
  out = "\""
  for (i = 1; i <= length(value); i++) {
    c = substr(value, i, 1)
    if (c == "\\") out = out "\\\\"
    else if (c == "\"") out = out "\\\""
    else {
      for (j = 1; j < 32; j++) if (c == sprintf("%c", j)) break
      out = out (j < 32 ? sprintf("\\u%04x", j) : c)
    }
  }
  return out "\""
}
BEGIN { printf "window._env = { VITE_API_BASE_URL: %s };\n", quote(ENVIRON["API_BASE_URL"]) }
' > "${ENV_CONFIG_PATH:-/usr/share/nginx/html/env-config.js}"

echo "Config generated successfully. Starting Nginx..."
exec "$@"
