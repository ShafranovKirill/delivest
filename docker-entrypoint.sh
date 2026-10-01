#!/bin/sh

cat <<EOF > /usr/share/nginx/html/env-config.js
window._env = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL:-https://delivest-server.shafranov.tech}",
  VITE_CAFE_NAME: "${VITE_CAFE_NAME:-Cafe_name}",
  VITE_SITE_DESCRIPTION: "${VITE_SITE_DESCRIPTION:-Описание сайта по умолчанию}",
  VITE_PHONE_NUMBER: "${VITE_PHONE_NUMBER:-+71234567890}",
  VITE_VK_URL: "${VITE_VK_URL:-https://vk.com}",
  VITE_INSTAGRAM_URL: "${VITE_INSTAGRAM_URL:-https://www.instagram.com}",
  VITE_YMAPS_URL: "${VITE_YMAPS_URL:-https://yandex.ru}",
  VITE_ADDRESS: "${VITE_ADDRESS:-ул. Уличная, 1/23, Город}",
  VITE_YANDEX_MAPS_API_KEY: "${VITE_YANDEX_MAPS_API_KEY:-}"
};
EOF

exec "$@"