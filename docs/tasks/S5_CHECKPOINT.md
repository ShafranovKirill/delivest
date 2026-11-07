# S5 checkpoint — 2026-11-07

Локальный результат на ветке `codex/refactor-s5`. Это checkpoint кода и
проверок, не production rollout. Root [draft PR №24](https://github.com/ShafranovKirill/delivest/pull/24),
agent commit `962df0d` в [PR №6](https://github.com/ShafranovKirill/delivest-agent/pull/6)
merged в develop (`21b321f`), server commit `9304708` в
[PR №25](https://github.com/ShafranovKirill/delivest-ex/pull/25)
merged в develop (`26f7b3b`). Root PR №24 остаётся draft.

## Реализовано

- O01/O02: агент заменяет legacy directory lock на flock и исправляет
  восстановление claimed backup job. Legacy lock-каталог требует ручной
  проверки перед удалением; обычный lock-файл удалять нельзя.
- O03: выпуск проверяет reusable checks/e2e, строит три candidate образа,
  проверяет digest и manifest до alias и публикует tag/release последними.
  Алиасы трёх образов не атомарны; при сбое alias tag/release не создаются.
- O04: checks для main/develop push/PR и workflow_call: server, agent,
  client, OpenAPI snapshot, API types, shell/actionlint/nginx/gitlinks.
  E2E reusable. Root PR №24: Checks 42341766511 и E2E
  42341766537 на frozen load harness SHA `16a150b` завершились SUCCESS.
  Предыдущие Checks 42338720512 и E2E 42338720441 также SUCCESS.
- O05: nginx access log использует `$uri` без query; synthetic marker тест
  проходит. Error log ограничен уровнем crit; критические сообщения могут
  содержать URL. Ротация старых логов, runtime secret audit и RN secure
  storage не выполнены.
- O08: expiry ограничен batch=100 по умолчанию, детерминированный порядок,
  worker snooze при оставшемся backlog, thumbnail ошибка сохраняет row и
  original для retry. Frontend map chunk не менялся без измерения.

## Проверки

- Agent: `mix format --check-formatted`, `MIX_ENV=test mix compile
  --warnings-as-errors` — exit 0; `MIX_ENV=test mix test` — 96/0,
  `/tmp/delivest-s5-agent-test.log`. Независимый targeted прогон — 37/0;
  после замечания ревью отдельный BackupJobs targeted — 10/0,
  `/tmp/delivest-s5-agent-backup-followup.log`.
- Restore drill: `scripts/restore-drill.sh --run` — exit 0,
  `/tmp/delivest-s5-restore-drill.log`, всего 92 с. Export 24 с, import
  14 с. Проверены PostgreSQL и байты публичного/закрытого S3 объекта по
  цепочке before → observed mutated → restored; повреждённый tar отклонён
  до изменения DB/объекта; tar с trailing payload также отклонён, guard
  остался цел. Drill без server и HTTP, на отдельном Compose
  project/томах; сервисы и тома удалены после прогона.
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
  завершён.
- Exploratory load на frozen root `16a150b`: 100/500/1000 сессий по
  120 с, 50 guest pickup/cash orders/min, 0 technical/4xx/429 во всех
  ступенях. Requests: 1333/6107/12056; p95 menu:
  41.58/62.26/70.60 мс, cart: 47.32/82.79/84.86 мс, order:
  70.99/88.46/90.70 мс. Все согласованные короткие exploratory gates
  пройдены. Полные условия, raw evidence и ограничения:
  [load results](../runbooks/load-results-2026-11-07.md).

## Открытые gates

O06 — одиночная нода описана, распределённые cache/limiter не реализованы.
O07 и N01/N03 получили короткий exploratory профиль с успешными gates,
но production capacity не доказана. Согласованные p95: menu 200 мс,
cart 300 мс, order 500 мс; technical errors <0.1%. Load scope:
guest/pickup/cash, 5 branches, 1000 products, из них 100 с modifier
choices, 15 promos. Cart/order выбрали plain products, modifier checkout
не проверен. N02 требует 5 мин warmup, 30 мин stable, 5 мин spike,
≥2 ч soak и три повтора; N04 — fault recovery и pilot. Генератор и
Phoenix работали на одном хосте в dev runtime, cache был тёплым.
SQL snapshots грубые по 5 с и включают drain/background; точное число
SQL на HTTP request, pool saturation и стабильность backlog не доказаны.
O05 требует реального аудита секретов и ротации.
O08 map/profile измерения и production backlog не проведены. Серверный
concurrent expiry regression использует SQL sandbox и не доказывает гонку
двух независимых DB transactions; существующий account lock сохранён.
Production и provider sandbox не запускались.
