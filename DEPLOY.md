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
curl -fsS https://delivest-server.example.com/health
curl -fsS https://delivest-server.example.com/ready
curl -I https://delivest-client.example.com
curl -I https://delivest-server.example.com/client/branches
```

`/health` отвечает, пока приложение живо. `/ready` дополнительно проверяет базу и применённые миграции и возвращает `503`, пока нода не готова; эту ручку используют агент и Bastion при обновлении. Остальные запросы должны ответить `200`. Дальше:

1. открыть `https://delivest-server.example.com/staff` и войти;
2. создать филиал, категории и товары;
3. открыть сайт клиента и оформить тестовый заказ.

## 8. Интеграции

- **Вход по номеру телефона (Zvonok):** в админке «Интеграции» → «Вход по номеру телефона» ввести API-ключ и ID кампании из кабинета zvonok.com, сохранить и вставить показанный адрес вебхука целиком в постбэк кампании. Адрес уже содержит макросы Zvonok `{ct_call_id}` и `{ct_phone}`, без них сервер не узнает, какой звонок подтверждён. Что пришло от Zvonok, видно в «Логах» админки. Настройка общая для всех филиалов.
- **Frontpad:** в админке «Интеграции» → «Frontpad» для выбранного филиала ввести API-ключ, включить передачу заказов и скопировать показанный адрес вебхука в Frontpad.

## 9. Бэкапы

### Полный слепок через админку

Администратор открывает «Франшиза» → «Полный слепок инстанса», создаёт архив и скачивает его после завершения задания. Архив содержит всю базу PostgreSQL, включая служебные таблицы и логи, и весь том SeaweedFS, включая закрытые файлы. Его следует хранить как секрет. Лимит загрузки по умолчанию 20 ГиБ; его можно изменить переменной `INSTANCE_BACKUP_MAX_ARCHIVE` (байты) в окружении сервера.

Для восстановления выберите `.tar`, подтвердите полную замену и отправьте задание. Сайт временно отключится. После запуска войдите с учётными данными администратора из исходного архива: текущие сотрудники и пароли заменяются. Старые выборочные ZIP-слепки филиала и франшизы не подходят для этого восстановления. Версии приложения на исходном и целевом сайтах должны быть совместимы; миграции целевой версии должны включать все миграции архива. Новый целевой сайт сначала запустите и примените его миграции, затем загружайте архив. Настройки целевого развёртывания и `.env` сохраняются; имя публичного и закрытого S3 bucket должно совпадать с исходным, а образ SeaweedFS должен иметь тот же image ID. Для локального запуска сначала выполните `make infra`: он собирает агента и обновляет закреплённый образ SeaweedFS. Затем перезапустите локальный Phoenix: `make dev` только подключается к существующей tmux-сессии и не перезапускает процесс. В production сервер и агент разделяют закрытый том `instance_backups`; Docker socket доступен только агенту.

При восстановлении одноузлового SeaweedFS агент пересоздаёт только состояние выборов и членства мастера из полного зеркала томов. Счётчик томов, ID топологии, состояние роста, данные filer и томов, а также исходный архив сохраняются. Отсутствующее или неполное зеркало отклоняется до изменений целевой сети.

Если задание прервано и отмечено как небезопасное, приложение остаётся остановленным. Не удаляйте `instance_backups` и не запускайте сервер вручную до проверки состояния оператором. После успешной замены прежняя база и копия прежнего содержимого хранилища остаются как артефакты восстановления в каталоге развёртывания `.delivest-recovery-<id>` и базе `delivest_previous_<id>`; удаляйте их только после проверки нового сайта. Архивы и завершённые задания в `instance_backups` также сохраняются: установите срок хранения и удаляйте их после проверки, чтобы не заполнить диск. Для аварийного запуска без админки доступен `scripts/full-backup` с явным `--replace` для импорта и `--leave-stopped` для экспорта перед переносом.

### Бэкапы базы в бастионе

Бэкапы базы делает бастион, если сайт к нему подключён (`BASTION_URL` и `BASTION_TOKEN` в `.env`). Каждый день в 03:00 МСК агент снимает дамп и отправляет его в хранилище бастиона, там лежат последние 7. Логи сайта в бэкап не входят, картинки товаров тоже: они в томе `s3_data`. Ещё один бэкап агент делает перед каждым обновлением из бастиона.

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
2. На странице старого сайта в бастионе откройте вкладку «Бэкапы» и скачайте нужный бэкап.
3. На странице нового сайта на вкладке «Бэкапы» выберите этот файл в «Восстановить из файла» и нажмите кнопку.

Скачайте бэкап до того, как удалять старую сеть из бастиона: после удаления её страницы нет.

Без бастиона, из скачанного файла, на новом сервере:

```bash
docker cp backup.dump ${COMPOSE_PROJECT_NAME:-delivest}_prod_postgres:/tmp/backup.dump
docker compose stop server
docker exec ${COMPOSE_PROJECT_NAME:-delivest}_prod_postgres sh -c 'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB" && pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges --exit-on-error /tmp/backup.dump && rm /tmp/backup.dump'
docker compose up -d server
```

Эти команды стирают текущую базу сайта, запускайте их только на новом сервере.

## Одна нода

Приложение работает на одной ноде: кэши Cachex и счётчики лимитов живут в памяти этой ноды. Переменные `RELEASE_NODE` и `DNS_CLUSTER_QUERY` не нужны, кластера нет. Масштабирование — вверх, деплой без простоя — на уровне nginx.

Вторая нода потребует доработки, иначе данные разойдутся:

- рассылка инвалидации кэшей по PubSub вместо локальных `Cachex.del/clear` (кэши сотрудников, меню, стопов, филиалов, акций, корзин);
- общий счётчик для `RateLimit` и `Crm.Throttle` (сейчас `rate_limit_cache`);
- хранение `kitchen_last_seen` в базе вместо ETS.

## Обновление

Для проверяемого выпуска используйте `release-manifest.json` из GitHub Release:
сверьте root SHA и gitlinks, затем закрепите server/client/agent по указанным
digest в отдельном Compose override. Порядок проверок, изолированный импорт
полного архива и откат описаны в [runbook](docs/runbooks/release-restore.md).
Теги `latest` могут измениться между подготовкой и запуском.

При обслуживании legacy lock каталога сначала остановите все операции агента
и убедитесь, что нет активных backup/restore/update. Удаляйте старый каталог
только после этой проверки. Файл flock не удаляйте во время работы процессов:
новый inode позволит двум операциям получить разные блокировки. Для RN
клиента требуется отдельное решение по защищённому хранению bearer token;
браузерные токены следует считать доступными JavaScript на странице и
проверять XSS/сторонние скрипты.

```bash
cd /root/delivest
git pull
docker compose pull
docker compose up -d
docker compose restart gateway
```

Если заполнены `BASTION_URL` и `BASTION_TOKEN`, то же самое можно сделать кнопкой в бастионе: агент сначала сделает бэкап базы, затем обновит все контейнеры, кроме себя, и подождёт до 5 минут, пока сайт ответит. Если сайт не поднялся, агент сам вернёт прежние образы, а вернуть их вручную можно кнопкой «Откатить». Самого агента обновляет кнопка «Обновить агента» на вкладке «Настройки». Команды `docker compose` запускайте из папки проекта: агент монтирует её по тому же пути, что и на сервере.

Инфраструктурные образы `gateway`, `postgres` и `s3` закреплены в `docker-compose.yml` по digest. Агент проверяет точный digest локально и не обращается к Docker Hub, если образ уже есть: ограничение Docker Hub не мешает обновить `server` и `client` из GHCR. Образы приложения намеренно используют `latest` и скачиваются при каждом обновлении. Если Docker Hub отвечает `429 Too Many Requests`, агент повторяет только скачивание нужного образа: до четырёх попыток с паузами 5, 15 и 45 секунд. Когда попытки исчерпаны, обновление останавливается до запуска контейнеров, поэтому работающий сайт не меняется. После восстановления доступа к registry нажмите обновление ещё раз.

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
