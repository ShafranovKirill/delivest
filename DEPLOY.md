# Деплой Delivest на пустой сервер

Инструкция для чистого сервера на Ubuntu 22.04 и новее. В конце работают три домена с HTTPS, сертификаты продлеваются сами.

```
браузер ──https──▶ nginx на хосте (TLS) ──▶ 127.0.0.1:GATEWAY_PORT ──▶ gateway ──▶ server / client / s3
```

## 0. Что нужно заранее

- Сервер: от 2 ГБ RAM и 20 ГБ диска, доступ по SSH под `root`.
- Три домена с A-записью на IP сервера. Проверить: `dig +short delivest-server.example.com`.

  | Домен (пример)                | Что там                             |
  | ----------------------------- | ----------------------------------- |
  | `delivest-client.example.com` | сайт для клиентов                   |
  | `delivest-server.example.com` | API, админка `/staff`, вебхуки      |
  | `delivest-s3.example.com`     | картинки товаров и акций            |

- Ключи zvonok.com, если нужен вход по звонку.

## 1. Подготовить сервер

```bash
apt update && apt upgrade -y
apt install -y git nginx certbot python3-certbot-nginx ufw
curl -fsSL https://get.docker.com | sh

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

Проверить: `docker compose version` и `nginx -v`.

## 2. Скачать проект

Образы публичные и берутся из GHCR, поэтому сабмодули на сервере не нужны.

```bash
cd /root
git clone https://github.com/ShafranovKirill/delivest.git
cd delivest
cp .env.example .env
```

## 3. Заполнить `.env`

Секреты удобно сгенерировать:

```bash
echo "SECRET_KEY_BASE=$(openssl rand -base64 48 | tr -d '\n')"
echo "DB_PASSWORD=$(openssl rand -hex 16)"
echo "S3_ACCESS_KEY=$(openssl rand -hex 12)"
echo "S3_SECRET_KEY=$(openssl rand -hex 24)"
```

| Переменная | Что указать |
| --- | --- |
| `COMPOSE_PROJECT_NAME` | имя проекта, например `delivest` |
| `GATEWAY_PORT` | свободный локальный порт, например `8080` |
| `PHX_HOST` | домен API без `https://`: `delivest-server.example.com` |
| `CLIENT_ORIGIN` | сайт с `https://`: `https://delivest-client.example.com` |
| `LETSENCRYPT_EMAIL` | почта для писем Let's Encrypt о сертификате |
| `SECRET_KEY_BASE` | сгенерированное значение |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `postgres` / сгенерированный пароль / `delivest` |
| `DB_HOST` | `postgres` (имя контейнера, не менять) |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | сгенерированные значения |
| `S3_HOST` и `S3_PUBLIC_HOST` | домен хранилища без `https://`: `delivest-s3.example.com` |
| `S3_SCHEME` | `https://` |
| `VITE_API_BASE_URL` | `https://delivest-server.example.com` |
| `VITE_YANDEX_MAPS_API_KEY` | ключ Яндекс Карт, можно пусто |
| `ZVONOK_PUBLIC_KEY` / `ZVONOK_CAMPAIGN_ID` | из кабинета zvonok.com |
| `ZVONOK_WEBHOOK_TOKEN` | любая случайная строка: `openssl rand -hex 16` |
| `APP_TIMEZONE` | `Europe/Moscow` |
| `ADMIN_LOGIN` / `ADMIN_PASSWORD` | первый админ; если пароль пустой, он сгенерируется |

Текст с пробелами берите в кавычки: `ADMIN_PASSWORD="пароль с пробелами"`.

## 4. Запустить контейнеры

```bash
docker compose pull
docker compose up -d
docker compose ps
docker logs delivest_server --tail 20
```

В логах сервера должна быть строка `Running DelivestWeb.Endpoint`. Миграции применяются сами при каждом старте.

## 5. Подключить nginx и получить сертификат

```bash
./deploy/host-nginx.sh
```

Скрипт:

1. читает домены и порт из `.env`;
2. получает один сертификат Let's Encrypt на все три домена;
3. пишет `/etc/nginx/sites-available/<COMPOSE_PROJECT_NAME>.conf` с HTTPS, HTTP/2 и редиректом с HTTP;
4. подменяет конфиг только после успешного `nginx -t`, поэтому работающий сайт не ломается;
5. ставит хук, который перезагружает nginx после автопродления сертификата.

Скрипт можно запускать повторно, например после смены доменов или порта.

## 6. Первичная настройка

```bash
docker exec -it delivest_server bin/delivest eval "Delivest.Release.setup"
```

Команда создаёт бакеты S3, роли и первого админа. **Если `ADMIN_PASSWORD` пустой, пароль выводится один раз — сразу сохраните его.** Повторный запуск безопасен: админ и пароль не меняются.

## 7. Проверить

```bash
curl -I https://delivest-client.example.com
curl -I https://delivest-server.example.com/client/branches
```

Оба должны ответить `200`. Дальше:

1. открыть `https://delivest-server.example.com/staff` и войти;
2. создать филиал, категории и товары;
3. открыть сайт клиента и оформить тестовый заказ.

## 8. Интеграции

- **Zvonok:** в кампании указать GET-постбэк
  `https://delivest-server.example.com/integrations/zvonok/<ZVONOK_WEBHOOK_TOKEN>`
  с параметрами `call_id` и `phone` подтверждённого звонка.
- **Frontpad:** в админке в настройках филиала включить CRM, ввести API-ключ и скопировать показанный там адрес вебхука в Frontpad.

## 9. Бэкапы каждый день

```bash
mkdir -p /root/backups
cat > /etc/cron.d/delivest-backup <<'EOF'
0 4 * * * root docker exec delivest_prod_postgres pg_dump -U postgres -Fc delivest > /root/backups/delivest-$(date +\%F).dump && find /root/backups -name 'delivest-*.dump' -mtime +14 -delete
EOF
```

Если вы меняли `COMPOSE_PROJECT_NAME`, `DB_USER` или `DB_NAME`, поправьте имена в этой строке.

Восстановление:

```bash
docker exec -i delivest_prod_postgres pg_restore -U postgres -d delivest --clean --if-exists < /root/backups/delivest-2026-10-21.dump
```

## Обновление

```bash
cd /root/delivest
git pull
docker compose pull
docker compose up -d
docker compose restart gateway
```

## Полный сброс базы

**Удаляет все заказы, клиентов и товары.** Картинки в S3 остаются.

```bash
cd /root/delivest
docker exec delivest_prod_postgres pg_dump -U postgres -Fc delivest > /root/backups/before-reset.dump
docker compose down
docker volume rm delivest_postgres_prod_data
docker compose up -d
docker exec -it delivest_server bin/delivest eval "Delivest.Release.setup"
```

## Несколько сайтов на одном сервере

Каждый сайт клонируется в свою папку со своим `.env`:

```dotenv
COMPOSE_PROJECT_NAME=pizza
GATEWAY_PORT=8081
PHX_HOST=api.pizza.example.com
CLIENT_ORIGIN=https://pizza.example.com
S3_HOST=files.pizza.example.com
S3_PUBLIC_HOST=files.pizza.example.com
```

Дальше в этой папке: `docker compose up -d`, `./deploy/host-nginx.sh` и `Release.setup` (имя контейнера будет `pizza_server`). Контейнеры, тома и сети получают префикс проекта, данные не пересекаются.

## Если что-то не работает

| Симптом | Где смотреть |
| --- | --- |
| 502 Bad Gateway | `docker compose ps`, `docker logs delivest_gateway`, `docker logs delivest_server` |
| сайт не открывается по HTTPS | `nginx -t`, `cat /etc/nginx/sites-available/delivest.conf`, `certbot certificates` |
| certbot не получает сертификат | DNS указывает на сервер? открыт порт 80 (`ufw status`)? |
| картинки не загружаются | `docker logs delivest-s3`, совпадают ли `S3_HOST` и `S3_PUBLIC_HOST` с доменом |
| нет входа по звонку | ключи Zvonok в `.env`, адрес постбэка, `docker logs delivest_server | grep -i zvonok` |
| конфликт `server_name` в nginx | удалите старые конфиги этих доменов из `/etc/nginx/sites-enabled/` |
