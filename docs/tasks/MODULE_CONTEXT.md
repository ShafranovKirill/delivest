# Карта контекста модулей

Первый столбец путей получен на checkout аудита `73f5458` и остаётся исторической подсказкой. S1 проверен на server commits из [PR №19](https://github.com/ShafranovKirill/delivest-ex/pull/19); остальные блоки требуют проверки на выбранном SHA. Перед работой над блоком записать актуальные путь:строку, вход UI/API, доменный метод, таблицу/миграцию, адаптер и тест. Не помещать сюда секреты и большие логи.

| Блок | Проверенные пути на checkout аудита; актуальность уточнить | Карта на выбранном SHA |
| --- | --- | --- |
| S1 | `server/lib/delivest/net/{products,catalogs,stops,menu_import,menu_export}.ex`; `server/lib/delivest/oms/orders/pricing.ex` | Server `a4958af` + `640b0ea` + `f4fc69d` ([server PR №19](https://github.com/ShafranovKirill/delivest-ex/pull/19)): staff UI → Net Products/Categories/Modifiers/Tags/MenuImport → `entity_relations`, `products`, `categories`, `external_ids`, `product_stops`; public menu → Catalogs/Promo.MenuPrices; order → CartGuard → request Product refs → Promo.Engine → Rewards/Earnings/Lines → Order. Миграции 12–14, tests net/oms/promo/site_snapshot/integrations/staff LiveView. См. [S1 checkpoint](S1_CHECKPOINT.md); главный агент проверил full 1346/0 (7 excluded), финальный UI target 2/0; server PR открыт, root PR pending. |
| S2 | `server/lib/delivest/identity/{client_auth,phone_confirmations,acl}.ex`; `server/lib/delivest/oms/carts.ex`; `client/src/modules/fulfillment/composables/useDeliveryQuote.ts`; `client/src/modules/auth/composables/useCallConfirmation.ts` | pending |
| S3 | `server/lib/delivest/oms/orders/create.ex`; `server/lib/delivest/payments/online.ex`; `server/lib/delivest/couriers/cash.ex`; `server/lib/delivest/events.ex`; `server/lib/delivest/integrations/yookassa/reconciliation.ex` | pending |
| S4 | `server/lib/delivest/integrations/{crm/provider,frontpad,iiko,rkeeper,yandex_eda/order_intake}.ex`; `server/lib/delivest/analytics.ex` | pending |
| S5 | `agent/lib/delivest_agent/{operation_lock,backup_jobs}.ex`; `agent/test/delivest_agent/backup_jobs_test.exs`; root `.github/workflows/{checks,e2e,release}.yml` | pending |

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
