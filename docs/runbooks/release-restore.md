# Выпуск и проверка восстановления

## Публикация

Push в `main` запускает `Release`: reusable `Checks` и `E2E`, вычисление версии,
сборку трёх образов с тегом `candidate-<root SHA>`, проверку digest всех образов,
присвоение тегов версии, minor и latest, затем tag и GitHub Release. Если сборка
или проверка digest завершилась ошибкой, tag и Release не создаются.
`release-manifest.json` в Release содержит SHA корня, gitlinks server/client/agent
и digest каждого образа. Сохраните его вместе с результатами проверок.

Перед обновлением сравните `git rev-parse HEAD` с `root_sha` в manifest и
`git rev-parse HEAD:server` (аналогично client/agent) с `gitlinks`. Для
воспроизводимого запуска используйте ссылки `ghcr.io/shafranovkirill/delivest-{server,client,agent}@sha256:…`
из manifest, а не изменяемые теги.

## Изолированная репетиция восстановления

Для локальной проверки механики без сервера и без рабочих томов запустите
`scripts/restore-drill.sh --run`. Скрипт требует локальные Docker images
`postgres:16-alpine` и закреплённый SeaweedFS 4.50, `aws`, `mix` и `curl`.
Он создаёт временный Compose project, экспортирует PostgreSQL и два S3 bucket,
меняет данные, импортирует архив и сверяет байты. Затем повреждает копию
архива и проверяет, что отказ не меняет контрольные данные. Проект и тома
удаляются при завершении; при ошибке Compose evidence сохраняется в `/tmp`.
Это проверка backup engine, а не HTTP сайта или production совместимости.

Команды ниже запускаются в отдельной копии каталога на тестовом хосте. В
`.env` задайте отдельные `COMPOSE_PROJECT_NAME=delivest_restore_test`,
`GATEWAY_PORT`, `DB_NAME`, домены, ключи и bucket. Не используйте имена
проектов, томов, портов или bucket работающего сайта.

```bash
cd /srv/delivest-restore-test
export COMPOSE_PROJECT_NAME=delivest_restore_test
docker compose config --quiet
docker compose up -d
mkdir -p evidence
./scripts/full-backup export evidence/before.tar --project-dir "$PWD" --project-name "$COMPOSE_PROJECT_NAME"
sha256sum evidence/before.tar > evidence/before.tar.sha256
./scripts/full-backup import evidence/source.tar --project-dir "$PWD" --project-name "$COMPOSE_PROJECT_NAME" --replace
docker compose ps > evidence/compose-after.txt
docker compose logs --no-color server agent > evidence/restore.log
docker compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Проверьте через отдельный домен HTTP API, данные в PostgreSQL, публичный и
закрытый медиафайлы в S3; запишите их идентификаторы и результаты в
`evidence/`. Сравните число записей и SHA256 скачанных файлов с источником.
Проверка одного HTTP ответа не подтверждает целостность базы и медиа.

Если восстановленный сайт неверен, остановите server и выполните импорт
сохранённого `before.tar` в том же изолированном проекте:

```bash
docker compose stop server
sha256sum -c evidence/before.tar.sha256
./scripts/full-backup import evidence/before.tar --project-dir "$PWD" --project-name "$COMPOSE_PROJECT_NAME" --replace
docker compose ps
```

Сохраните `evidence/`, архивы, manifest, digest запущенных контейнеров
(`docker compose images --format json`) и логи до завершения ревью. Архивы
содержат секреты; храните их с ограниченным доступом и удаляйте по сроку
хранения после проверки. При компрометации обновите пароли базы, S3 и токены
интеграций; отозвать браузерный bearer token можно только через действующий
механизм сессии или смену соответствующего секрета. Токены в браузере
доступны скриптам на странице, поэтому проверяйте сторонние скрипты и XSS.

Gateway и host nginx записывают в access log путь `$uri` без query.
Обычные сообщения error log подавлены до уровня `crit`; редкие критические
ошибки могут содержать исходный URL. Перед распространением error log
проверяйте его на секреты. Ротация и удаление уже записанных логов требуют
отдельной операции у оператора; эта настройка их не очищает.

Для legacy `.delivest-operation.lock` в виде каталога новый агент возвращает
busy и не удаляет каталог. Перед ручным удалением остановите agent и другие
процессы, способные выполнять операции, проверьте статус backup job и
отсутствие незавершённого import/export. Обычный lock-файл `flock` не удаляйте:
удаление inode во время активной операции позволяет второму процессу получить
новый lock по тому же пути.

Браузерный сохранённый bearer доступен коду страницы при XSS. Перенос на
HttpOnly cookie требует отдельного ADR с CSRF и совместимостью с текущими
сессиями; в этом выпуске схема хранения не меняется. Для будущего нативного
клиента токены следует хранить в Keychain/Keystore; приложение RN здесь не
реализовано. Серверные ключи держите в переменных окружения и `.env` с
ограниченными правами, включая резервные копии. Инвентаризация и ротация
действующих секретов остаются отдельным действием оператора; значения
секретов не включайте в evidence и логи.
