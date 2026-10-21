#!/bin/sh

echo "Generating runtime environment config..."

cat <<EOF > /usr/share/nginx/html/env-config.js
window._env = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL:-https://delivest-server.shafranov.tech}",
  VITE_YANDEX_MAPS_API_KEY: "${VITE_YANDEX_MAPS_API_KEY:-}"
};
EOF


echo "Config generated successfully. Starting Nginx..."
exec "$@"