#!/bin/sh

cat <<EOF > /usr/share/nginx/html/env-config.js
window._env = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL:-https://delivest-server.shafranov.tech}",
  VITE_CAFE_NAME: "${VITE_CAFE_NAME:-Cafe_name}",
  VITE_SITE_DESCRIPTION: "${VITE_SITE_DESCRIPTION:-Описание сайта по умолчанию}",
  VITE_YANDEX_MAPS_API_KEY: "${VITE_YANDEX_MAPS_API_KEY:-}"
};
EOF

exec "$@"