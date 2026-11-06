# S3 — заказы, деньги и очереди

## База

S2 принят в `develop` после проверок. Сначала влиты [server PR №21](https://github.com/ShafranovKirill/delivest-ex/pull/21) и [client PR №14](https://github.com/ShafranovKirill/delivest-web/pull/14), затем [root PR №20](https://github.com/ShafranovKirill/delivest/pull/20). Стартовые SHA веток `codex/refactor-s3` — root `abb1fef`, server `80fdbfc`, client `dfadbe5`.

Исходный замер оформления заказа на server `80fdbfc` — 32 SQL/заказ, p50 19,89 мс, p95 24,43 мс, 300 заказов сохранены. Профиль [S1 harness](support/s1-order-bench.exs) — 5 филиалов, 50 прогревов, 250 замеров, 10 параллельных запросов, отдельная тестовая БД и `ERL_FLAGS='+S 4:4'`. Лог `/tmp/delivest-s3-base-order.log`. Это локальный замер пути заказа без вызова платёжного провайдера.

Подготовка ссылки оплаты остаётся синхронной. Условия для отдельного изменения зафиксированы в [ADR](ADR-S3-PAYMENT-INITIALIZATION.md).
