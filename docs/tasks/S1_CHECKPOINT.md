# S1 checkpoint — каталог, pricing, cache

Дата: 2026-11-06. Статус: реализация code worker проверена главным агентом локально; [server PR №19](https://github.com/ShafranovKirill/delivest-ex/pull/19) открыт, root PR pending, merge/rollout pending. S1 ID имеют статус `implemented-local` в `COVERAGE.md`; `done` только после merge и требуемых gates.

## T00 baseline и воспроизведение

- Baseline root `727b492`, server `760dcf6`, ветки `codex/refactor-s1`; исходные деревья были чистые. Root fast-forward до плановой базы `8b87d13`; server commits `a4958af` (catalog), `640b0ea` (pricing), `f4fc69de8dcf2d9a1c46d6b5a5c1cea0b3d05c88` (test isolation). Gitlinks `origin/develop`: server `4fce7b3`, client `cde8e9e`, agent `9f75a63`. PR аудита №16 и client auth №13 открыты; client/agent не менялись.
- Тестовая БД использовала `TEST_DB_HOST=127.0.0.1` и новые `MIX_TEST_PARTITION=s1_20261106_*`; стандартная тестовая БД не сбрасывалась. Исходный catalog suite: 42 tests, 0 failures (`/tmp/delivest-s1-baseline.log`). Добавленные до fix negative repro D01/D03: 36 tests, 2 ожидаемых падения (`/tmp/delivest-s1-repro.log`).
- Read-only [preflight SQL](support/s1-stop-conflicts.sql) на изолированной БД: 0 `NULL branch_id`, 0 stop rows без связи Branch/Product, 0 дублей нового ключа stop/CRM ID и 0 cross-branch rollback collisions (`/tmp/delivest-s1-preflight-final.log`). Это не отчёт production данных; выполнить SQL на целевой БД до rollout.

## Решение и реализация

- [ADR](ADR-S1-CATALOG-OWNERSHIP.md): общие Product/Category сохраняются, shared поля требуют permission всех владельцев; orphan mutation только admin. Modifier/Tag глобальны и меняются через `catalog.global.manage`; Client permissions остаются installation-global.
- Stop unique key `(branch_id, product_id, source)`, branch-scoped stop/resume/external sync. CRM ID unique key `(entity_type, entity_id, branch_id, provider)` и branch-scoped read/write в экспорте, UI и адаптерах. Существующие `branch_id` сохраняются.
- Импорт проверяет требуемые create/update/delete/category/global permissions и всех владельцев до side effects. Snapshot branch import проверяет global capability до загрузки blobs. Общие изменения инвалидируют все затронутые филиалы.
- CSV user-text с начальными `= + - @` после whitespace/control получает `'` только при экспорте; БД не меняется.
- `branches.catalog_version` обновляется в транзакции основных writers, menu/promo cache keys включают version, cart cache проверяет version из Cart+Branch metadata SELECT. Cold cache и Cachex error/exit используют DB fallback. Checkout использует ephemeral request Product snapshot для cart, promo, lines, earnings/rewards; повторная оценка detached cart удалена только из внутреннего checkout path.

## Локальные замеры

Одинаковый order harness: 5 филиалов, 50 warmup + 250 измеренных заказов, concurrency 10, отдельные fresh DB. Изолированный локальный профиль, не production capacity.

| Метрика | До (`s1_20261106_bench_before`) | После (`s1_20261106_bench_final2`) |
| --- | ---: | ---: |
| SQL/заказ | 36.0 | 32.0 (−11.1%) |
| p50 / p95, ms | 21.48 / 47.72 | 21.10 / 42.19 |
| SQL query time total, ms | 5154.12 | 4910.92 |
| pool queue total, ms | 181.07 | 190.11 |
| ошибок | 0 | 0 |

Cart harness: 50 warmup + 250 mutation/read, отдельные fresh DB. Mutation: SQL 8→9, p50 2.05→2.30 ms, p95 2.58→3.07 ms. Read: SQL 1→1, p50 0.14→0.16 ms, p95 0.23→0.28 ms. Все операции завершились без ошибок; финальный read проверяет `%CartView{}`. Дополнительный SQL mutation нужен для version stamp; это наблюдаемая регрессия. [Order harness](support/s1-order-bench.exs), [cart harness](support/s1-cart-bench.exs), логи `/tmp/delivest-s1-order-{before,final2}.log`, `/tmp/delivest-s1-cart-{before,final2}.log`. CPU и SQL attribution по группам не измерены.

## Миграция и откат

Миграции `20261210000012` (stops), `13` (catalog_version), `14` (CRM IDs). В отдельной `delivest_tests1_20261106_rollback` БД rollback `14` отказал при двух branch CRM IDs, после удаления одной **тестовой** CRM строки rollback `14` и `13` прошёл. Rollback `12` отказал при двух branch stops; count после отказа остался 2. Логи `/tmp/delivest-s1-rollback-{external-refusal,safe,stops-refusal}.log`. Старый application writer несовместим с новым conflict target после удаления прежних unique индексов: rollout требует координированного cutover без старых concurrent writers. Rollback при конфликте останавливается для ручного решения; данные автоматически не сливаются и не удаляются.

## Gates и оставшиеся границы

Целевые тесты: S1 catalog `51/0`, R06/R07 `102/0`, integration/UI/snapshot `76/0`, measured cut `91/0`, CRM/legacy fixes `50/0`; после review тест настоящих меню обоих филиалов `mix test test/delivest/net/categories_test.exs test/delivest/net/products_test.exs` — `41/0`. Команды запускались в `server/` с `TEST_DB_HOST=127.0.0.1 MIX_TEST_PARTITION=s1_20261106_01`. Первый `mix precommit` завершился `1344 tests, 1 failure (7 excluded)`: несвязанный `Crm.ThrottleTest` с интервалом 100 ms получил `:done` вместо throttled под нагрузкой. Отдельный `mix test test/delivest/integrations/crm/throttle_test.exs` прошёл `6/0`; повторный `mix precommit` прошёл `1344/0 (7 excluded)`. Логи `/tmp/delivest-s1-precommit{,-repeat}.log`, `/tmp/delivest-s1-throttle-repeat.log`. `mix format --check-formatted` завершился exit 0. `mix dialyzer` в default dev environment и CI-equivalent `MIX_ENV=test mix dialyzer` прошли (оба `Total errors: 2, Skipped: 2, Unnecessary Skips: 0`, exit 0, проектный `.dialyzer_ignore.exs`); логи `/tmp/delivest-s1-dialyzer{,-test}.log`. Live-provider contract проверки не запускались. O05 finance/privacy triage и C01 auth PR13 остаются отдельными блоками; S3 R02 transaction redesign не включён.

### Итоговый независимый gate и review

Главный агент просмотрел текущий diff. Его первый full suite на fresh `s1_20261106_main_review` завершился 1344/1 из-за DB checkout timeout в `ClientLive.Show` setup; точную блокировку `pg_locks` в момент ошибки не сняли. Три async fixture использовали уникально ограниченное имя филиала `Main`, что создаёт сильную гипотезу конкурентного ожидания; они переведены на factory unique names. Независимый повтор с тем же seed `532770`: `1346 tests, 0 failures (7 excluded)`, 56.1 s, `/tmp/delivest-s1-main-review-repeat.log`. Первый лог `/tmp/delivest-s1-main-review.log` сохранён.

После этого полного suite внесена только финальная правка ProductFormComponent alert `id`/Tailwind utility и LiveView test selector по `server/AGENTS.md`. Целевые два теста `2/0` (`/tmp/delivest-s1-ui-final-targeted.log`); `MIX_ENV=test mix compile --warnings-as-errors` и `mix format --check-formatted` завершились exit 0. Полный suite после этой косметической правки не повторялся. [server PR №19](https://github.com/ShafranovKirill/delivest-ex/pull/19) открыт от `develop`; remote CI проверить в PR. Root commit/PR, merge и rollout pending; итоговую приёмку выполняет главный агент.

Все десять созданных S1 test partition БД очищены; последнюю `_main_review` удалил главный агент (`/tmp/delivest-s1-main-review-cleanup.log`). Стандартная тестовая БД не сбрасывалась.
