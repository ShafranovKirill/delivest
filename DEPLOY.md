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
| `APP_TIMEZONE` | `Europe/Moscow` |
| `ADMIN_LOGIN` / `ADMIN_PASSWORD` | первый админ; если пароль пустой, он сгенерируется |
| `BASTION_URL` / `BASTION_TOKEN` | адрес бастиона (`wss://...`) и токен агента; если пусто, агент ничего не делает |
| `INSTANCE_NAME` | имя сайта в бастионе, по умолчанию `PHX_HOST` |

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

- **Вход по номеру телефона (Zvonok):** в админке «Интеграции» → «Вход по номеру телефона» ввести API-ключ и ID кампании из кабинета zvonok.com, сохранить и вставить показанный адрес вебхука целиком в постбэк кампании. Адрес уже содержит макросы Zvonok `{ct_call_id}` и `{ct_phone}`, без них сервер не узнает, какой звонок подтверждён. Что пришло от Zvonok, видно в «Логах» админки. Настройка общая для всех филиалов.
- **Frontpad:** в админке «Интеграции» → «Frontpad» для выбранного филиала ввести API-ключ, включить передачу заказов и скопировать показанный адрес вебхука в Frontpad.

## 9. Бэкапы

Бэкапы базы делает бастион, если сайт к нему подключён (`BASTION_URL` и `BASTION_TOKEN` в `.env`). Каждый день в 03:00 МСК агент снимает дамп и отправляет его в хранилище бастиона, там лежат последние 7. Логи сайта в бэкап не входят, картинки товаров тоже: они в томе `s3_data`.

На странице сети в бастионе есть список бэкапов и кнопки «Сделать бэкап», «Скачать» и «Восстановить». При восстановлении:

- сервер выключается, бэкап разворачивается во временную базу и только потом подменяет рабочую;
- если файл битый, рабочая база не меняется;
- прежняя база остаётся как `<DB_NAME>_before_restore` до следующего восстановления;
- сервер включается и сам применяет миграции, так что старый бэкап подходит и к новой версии.

Откатить восстановление:

```bash
docker compose stop server
docker exec ${COMPOSE_PROJECT_NAME:-delivest}_prod_postgres sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "ALTER DATABASE \"$POSTGRES_DB\" RENAME TO \"${POSTGRES_DB}_broken\"" -c "ALTER DATABASE \"${POSTGRES_DB}_before_restore\" RENAME TO \"$POSTGRES_DB\""'
docker compose up -d server
```

### Перенос сети на другой сервер

1. Разверните новый сайт по этой инструкции и подключите его к бастиону.
2. На странице нового сайта в бастионе выберите в «Развернуть сюда бэкап другой сети» нужный бэкап и нажмите «Восстановить».

Бэкапы удалённой из бастиона сети не пропадают, их тоже можно развернуть.

Без бастиона, из скачанного файла, на новом сервере:

```bash
docker cp backup.dump ${COMPOSE_PROJECT_NAME:-delivest}_prod_postgres:/tmp/backup.dump
docker compose stop server
docker exec ${COMPOSE_PROJECT_NAME:-delivest}_prod_postgres sh -c 'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB" && pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges --exit-on-error /tmp/backup.dump && rm /tmp/backup.dump'
docker compose up -d server
```

Эти команды стирают текущую базу сайта, запускайте их только на новом сервере.

## Обновление

```bash
cd /root/delivest
git pull
docker compose pull
docker compose up -d
docker compose restart gateway
```

Если заполнены `BASTION_URL` и `BASTION_TOKEN`, то же самое можно сделать кнопкой в бастионе: агент обновит все контейнеры, кроме себя. Команды `docker compose` запускайте из папки проекта: агент монтирует её по тому же пути, что и на сервере.

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
