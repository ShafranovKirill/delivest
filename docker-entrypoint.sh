#!/bin/sh

echo "Generating runtime environment config..."

cat <<EOF > /usr/share/nginx/html/env-config.js
window._env = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL:-https://delivest-server.shafranov.tech}"
};
EOF


echo "Config generated successfully. Starting Nginx..."
exec "$@"