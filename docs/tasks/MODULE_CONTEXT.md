# Карта контекста модулей

Ниже точные пути, проверенные исследователем на checkout аудита `73f5458`. **Семантическая карта и соответствие выбранному SHA ещё не проверены.** Перед работой над блоком записать актуальные путь:строку, вход UI/API, доменный метод, таблицу/миграцию, адаптер и тест. Не помещать сюда секреты и большие логи.

| Блок | Проверенные пути на checkout аудита; актуальность уточнить | Карта на выбранном SHA |
| --- | --- | --- |
| S1 | `server/lib/delivest/net/{products,catalogs,stops,menu_import,menu_export}.ex`; `server/lib/delivest/oms/orders/pricing.ex` | pending |
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
