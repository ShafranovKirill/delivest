# S5 checkpoint — 2026-11-07

Локальный результат на ветке `codex/refactor-s5`. Это checkpoint кода и
проверок, не production rollout. Root и server PR/remote CI и review
указываются после публикации. Agent commit `962df0d` в [PR №6](https://github.com/ShafranovKirill/delivest-agent/pull/6);
server commit `9304708` локальный.

## Реализовано

- O01/O02: агент заменяет legacy directory lock на flock и исправляет
  восстановление claimed backup job. Его отдельные tests и restore drill
  фиксируются после завершения независимой проверки.
- O03: выпуск проверяет reusable checks/e2e, строит три candidate образа,
  проверяет digest и manifest до alias и публикует tag/release последними.
  Алиасы трёх образов не атомарны; при сбое alias tag/release не создаются.
- O04: checks для main/develop push/PR и workflow_call: server, agent,
  client, OpenAPI snapshot, API types, shell/actionlint/nginx/gitlinks.
  E2E reusable. Фактический remote CI на PR ещё требуется.
- O05: nginx access log использует `$uri` без query; synthetic marker тест
  проходит. Error log ограничен уровнем crit; критические сообщения могут
  содержать URL. Ротация старых логов, runtime secret audit и RN secure
  storage не выполнены.
- O08: expiry ограничен batch=100 по умолчанию, детерминированный порядок,
  worker snooze при оставшемся backlog, thumbnail ошибка сохраняет row и
  original для retry. Frontend map chunk не менялся без измерения.

## Проверки

- Server: `MIX_TEST_PARTITION=s5ops TEST_DB_HOST=127.0.0.1 mix test
  test/delivest/loyalty_test.exs test/delivest/media/thumbnails_test.exs` —
  28/0. `mix precommit` с теми же env — 1421/0, 7 excluded;
  `/tmp/delivest-s5-server-targeted.log` и
  `/tmp/delivest-s5-server-precommit.log`.
- Root: actionlint, shellcheck выбранных скриптов, bash/sh syntax,
  `test-release-images.sh` (missing/malformed/mismatched digests),
  `test-nginx-log.sh` (query marker) и nginx gateway/client `-t` —
  локально exit 0. Проверка host nginx генератора на production host
  не выполнялась.
- Client: auth 7/7, regression 26/26, build/ESLint, schema snapshot и
  OpenAPI diff exit 0; dialyzer server exit 0 с двумя историческими skips.
  Playwright `CI=1 NO_PROXY=localhost,127.0.0.1,::1
  npm_config_no_proxy=localhost,127.0.0.1,::1
  DEV_DATABASE=delivest_s5_e2e pnpm exec playwright test` — 27/27,
  `/tmp/delivest-s5-e2e-verified.log`. Первые попытки exit 130/1 были
  остановлены на промежуточном коде и proxy environment; финальный прогон
  завершён. Agent fault/restore/load результаты добавить после независимой
  проверки.

## Открытые gates

O06 — одиночная нода описана, распределённые cache/limiter не реализованы.
O07 и N01–N04 требуют измерений, согласования критериев, fault и pilot/soak
на изолированной среде. O05 требует реального аудита секретов и ротации.
O08 map/profile измерения и production backlog не проведены. Серверный
concurrent expiry regression использует SQL sandbox и не доказывает гонку
двух независимых DB transactions; существующий account lock сохранён.
Production и provider sandbox не запускались.
