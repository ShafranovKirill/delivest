#!/bin/sh
set -eu

echo "Generating runtime environment config..."

awk '
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
BEGIN {
  print "window._env = {"
  api = ENVIRON["VITE_API_BASE_URL"]
  if (api == "") api = "https://delivest-server.shafranov.tech"
  printf "  VITE_API_BASE_URL: %s", quote(api)
  split("VITE_STOREFRONT_BOOTSTRAP VITE_STOREFRONT_BOOTSTRAP_BRANCH_IDS VITE_STOREFRONT_UPDATES VITE_STOREFRONT_UPDATES_BRANCH_IDS VITE_FUNNEL_BATCHING VITE_FUNNEL_BATCHING_BRANCH_IDS", keys, " ")
  for (i = 1; i <= 6; i++) {
    if (ENVIRON[keys[i]] != "") printf ",\n  %s: %s", keys[i], quote(ENVIRON[keys[i]])
  }
  print "\n};"
}' > "${ENV_CONFIG_PATH:-/usr/share/nginx/html/env-config.js}"


echo "Config generated successfully. Starting Nginx..."
exec "$@"
