# Карта контекста модулей

Первый столбец путей получен на checkout аудита `73f5458` и остаётся исторической подсказкой. S1 проверен на server commits из [PR №19](https://github.com/ShafranovKirill/delivest-ex/pull/19); остальные блоки требуют проверки на выбранном SHA. Перед работой над блоком записать актуальные путь:строку, вход UI/API, доменный метод, таблицу/миграцию, адаптер и тест. Не помещать сюда секреты и большие логи.

| Блок | Проверенные пути на checkout аудита; актуальность уточнить | Карта на выбранном SHA |
| --- | --- | --- |
| S1 | `server/lib/delivest/net/{products,catalogs,stops,menu_import,menu_export}.ex`; `server/lib/delivest/oms/orders/pricing.ex` | Root delivery `9df49b8`; server `a4958af` + `640b0ea` + `f4fc69d` + `a1c28b5` + `8559b05` ([server PR №19](https://github.com/ShafranovKirill/delivest-ex/pull/19)): staff UI → Net Products/Categories/Modifiers/Tags/MenuImport → `entity_relations`, `products`, `categories`, `external_ids`, `product_stops`; public menu → Catalogs/Promo.MenuPrices; order → CartGuard → request Product refs → Promo.Engine → Rewards/Earnings/Lines → Order. Миграции 12–14, tests net/oms/promo/site_snapshot/integrations/staff LiveView. См. [S1 checkpoint](S1_CHECKPOINT.md); главный агент проверил исходный full 1346/0 (7 excluded); D04/LogLive follow-up worker full 1350/0 и независимый финальный full 1350/0 (7 excluded, seed `532770`); server PR открыт, [root PR №18](https://github.com/ShafranovKirill/delivest/pull/18) открыт. |
| S2 | `server/lib/delivest/identity/{client_auth,phone_confirmations}.ex`; `server/lib/delivest/oms/{orders,orders/create,orders/notifier}.ex`; `server/lib/delivest_web/channels/orders_channel.ex`; `client/src/modules/{auth,cart,fulfillment,pwa,order}` | [S2 checkpoint](S2_CHECKPOINT.md): server b24501d/client 655d365, local accepted; remote CI/merge separately |
| S3 | `server/lib/delivest/oms/orders/create.ex`; `server/lib/delivest/payments/online.ex`; `server/lib/delivest/couriers/cash.ex`; `server/lib/delivest/events.ex`; `server/lib/delivest/integrations/yookassa/reconciliation.ex` | [S3 checkpoint](S3_CHECKPOINT.md); Oms.Checkout → Create key/replay + CartGuard revision; Cash locked settlement; expiry per-device Oban; explicit incomplete reconciliation. |
| S4 | `server/lib/delivest/integrations/{crm/reconciliation,rkeeper/poller,yandex_eda/stop_list,yandex_eda/order_address}.ex`, `server/lib/delivest/analytics.ex` | [S4 checkpoint](S4_CHECKPOINT.md). Ограниченные бюджеты intake и отчётов, отдельный опрос r_keeper, возможности адаптеров и аудит сверки. |
| S5 | `agent/lib/delivest_agent/{operation_lock,backup_jobs}.ex`; `agent/test/delivest_agent/backup_jobs_test.exs`; root `.github/workflows/{checks,e2e,release}.yml` | pending |

## S2 — контекст для продолжения

- Order client_id — контакт/loyalty/history, не доказательство authenticated origin. Guest session access задаётся только trusted public-create option, поле guest_session_access не cast-ится. `Orders.owner_filter` и `owned_by?` защищают REST/events; Notifier публикует session topic только для explicit guest. Миграция 15 консервативно ограничивает legacy session access; детали/rollback в checkpoint.
- CRM manual paths используют actor-aware Catalog.refresh/3, StopSync.sync/2, Iiko.load_settings/2 и register_webhooks/2. Phone start держит DB locks по normalized phone/session, reservation учитывает provider failures.
- Client session epoch + cart context generation защищают async state. Fulfillment/checkout drafts имеют владельца; WebPush boundary использует durable block/legacy SW ack, unsubscribe barrier и captured-token raw HTTP. Не возвращать прежние unscoped storage keys и OR owner predicate.
- Проверки: main server 1366/0; main client auth7/regression25; full Playwright27/27. Root CI запускает auth/regression и Node22.22.2. T03/T09 implemented-local; D07/R02 остаются S3, O05 runtime secret/log review остаётся S5.

## Краткая запись после работы

```text
Блок / выбранный SHA / PR:
UI → API → домен → storage → integration → tests (пути:строки):
Решение / ADR:
Воспроизведение и изменение:
Команды и реальные результаты:
Миграция / rollback / неизвестные исходы:
Следующий checkpoint:
```
