# Delivest — F01, краткая передача

## Цель и разрешения

Довести согласованный F01: Segments, постоянные маркетинговые политики, награды существующих Promo/Loyalty, независимые Notifications, клиентские каналы/карточки, фоновые отчёты. Реализация, коммиты, push и PR разрешены. Значительную фичу не merge без ревью владельца; main/production не разрешены. Режим обычный. Все решения ниже подтверждены владельцем; новых вопросов нет.

## Продуктовые решения

- Только completed заказы **везде**: количество, давность, выручка, новый цикл и актуальность предложения (последнее уточнение владельца 10 ноября). Незавершённые/отменённые не меняют цикл. Одна выдача policy/client/completed-order cycle; повторное завершение того же заказа не новый цикл.
- Установка = франшиза + филиалы. Настройки администратору; служебные группы руководителям своей области. Host feature flags только владельцу через CLI, не staff.
- Один общий bounded Background/Oban оркестратор; выключенное не создаёт необязательные данные/расчёты/ожидающие jobs. Суточные пересчёты допустимы. Original generation + job owner, canonical union gate locks, immutable source epochs защищают от старых попыток и off/on.
- Future-only замораживает eligible (client, cycle), включая паузу незавершённой подготовки. Issue/reward/notice атомарны. Сегменты независимы; изменение используемой группы требует актуальные impact/revision/confirmation.
- Notifications: in_app/Push/SMS; отдельная клиентская страница каналов. Маркетинговые согласия default false, SMS пока unavailable без провайдера. Core order/account Push независим. Карточки под хедером рядом с активным заказом, ручное закрытие per-device без отмены награды.
- Отчёт observational, явное окно, общие заказы dedupe, unknown не считать delivered. Historical bonus usage/cost per Issue неизвестен: ledger не хранит allocation debit→credit. Не выдумывать его по remaining. Production capacity не подтверждалась.
- F02/F05, полная F04, native apps, billing и production не входят.

## Git

- Root/server `codex/f01-marketing-policies`; server F01 `7865c5d`, clean и push подтверждён, PR https://github.com/ShafranovKirill/delivest-ex/pull/31 готов к ревью.
- Client `codex/f01-notifications`: 3e08c77, 5d1dda5, 9f60b3a; clean, push подтверждён, PR https://github.com/ShafranovKirill/delivest-web/pull/20.
- Agent `codex/f01-optional-deliveries`: 27c94f1; clean, push подтверждён, PR https://github.com/ShafranovKirill/delivest-agent/pull/8. Restore отменяет optional_feature jobs, сохраняет core.
- Зависимая основа уже готова, CI зелёный, не merged: root #34 / server #30 / agent #7. Base server7176fa5 / agent1395fe0 / rootd922829. F01 PR включают эту ещё не слитую основу; интеграция только после ревью владельца.

## Проверки и оставшиеся шаги

- Root финальный `mix precommit` fresh f01accept3_20261110: **1536 tests, 0 failures, 7 excluded**, compile warnings-as-errors / format / strict Credo зелёные. Лог /tmp/delivest-f01-final-precommit3-20261110.log. Dialyzer passed (2 прежних предупреждения штатно исключены, unnecessary skips0); /tmp/delivest-f01-final-dialyzer-20261110.log. Первый прогон1530/20fail был загрязнён unboxed NotificationsConcurrency fixture; cleanup исправлен, оба повторных свежих прогона зелёные.
- Root agent integration + full_backup targeted **25/25**, /tmp/delivest-f01-final-agent-20261110.log. Root client auth7/7 + push10/10; worker typecheck/build зелёные.
- Independent high review: финансовые owner/source fences, frozen cohorts, pause/resume, Report cleaning/comparison locks, manual impact guard, generic disabled role permissions — без открытых замечаний. Reviewer также независимо Report+Notifications15/15 fresh DB. DB finance/completion races2/2 входят в default CI.
- Ручной browser test на изолированной test DB: пять шагов → сохранённый черновик, Back сохраняет сообщение, RU/EN, dark contrast, исключения без UUID. UI worker6/6 regressions, scoped compile/format clean. Временный сервер localhost4402, MIX_TEST_PARTITION=f01visual20261110, unified exec84959 (TTY, остановить двумя Ctrl-C).
- Comparison picker pager завершён: следующие страницы по50, выбор сохраняется, тест52политики+скрытая область; UI7/7. Независимые ревью закрыли все найденные замечания. На момент этого коммита остаются root gitlinks/PR и remote CI; проверять актуальный статус на PR перед интеграцией. Временный сервер4402 остановить после ручной проверки.
- Все миграции/проверки строго MIX_ENV=test TEST_DB_HOST=127.0.0.1 MIX_TEST_PARTITION=новое_имя. Старые default/worker partitions могли иметь drift; не использовать и не латать вручную. Root независимо проверил финальные migration24/25 up/down/up в f01schemafinal20261110; OpenAPI JSON совпадает с client snapshot. Schema заморожена.

## Источники

Notion canonical spec: https://app.notion.com/p/41031ec95e4481b5b776d0e5d9b09657 — решения 10 ноября сохранены через notion-knowledge-capture. Локальный старый экспорт docs/tasks/notion-current/features-spec.md не содержит последних уточнений; этот HANDOFF и docs/tasks/F01_ACCEPTANCE.md приоритетнее. Реализация: server/docs/tasks/marketing-report.md, docs/tasks/ADR-BACKGROUND-ORCHESTRATION.md, server/docs/background-features.md. История: docs/tasks/archive/HANDOFF-2026-11-10-foundation.md и HANDOFF-2026-11-10-f01-review.md.
