# Delivest — F01, краткая передача

## Локальное демо — 10 ноября 2026

По просьбе владельца запущено изолированное dev-демо: PostgreSQL `delivest_f01_demo_20261110`, backend http://localhost:4000, клиент http://localhost:3000/demo-center. Основные базы не изменялись. Сервисы запущены отдельными процессами; PID-файлы `/tmp/delivest-f01-demo-server.pid`, `/tmp/delivest-f01-demo-client.pid`, логи `/tmp/delivest-f01-local-demo.log`, `/tmp/delivest-demo-client.log`. После перезагрузки компьютера запускать вручную по `server/docs/tasks/local-f01-demo.md`.

Данные: 3 филиала, 185 синтетических клиентов (+ один создан при UI-проверке), 1819 заказов за 90 дней, 6 сегментов, 4 политики, 55 выдач. У клиента +79990000001 две неиспользованные карточки и 500 бонусов; в телефонной маске вводить `9990000001`, dev-вход подтверждается автоматически. Сотрудник `demo_admin` / `DemoPassword123!` — исключительно демо-учётка в изолированной БД. Проверены вход, продажи, маркетинговые карточки, бонусы, каналы и готовый отчёт бонусной политики: 13 повторных заказов, выручка 11 340 рублей. Внешние HTTP/Push блокируются launcher-адаптером 503, fiscal/online/CRM отключены.

Root/server сейчас `codex/f01-local-demo`, создана от актуального develop и fast-forward согласованной F01. Server демо-коммит `c455533`; исправления `703c6f6` (очередь preview продолжает pending без суточного ожидания) и `ee000d8` (денежные суммы отчётов в рублях). Исходные исправления также сохранены в отдельной ветке `codex/f01-preview-queue`, коммиты `33cd5b8`, `deb6483`, worktree `/tmp/delivest-f01-preview-queue`. Root сверил идентичность четырёх изменённых файлов между ветками, независимо просмотрел diff; reviewer замечаний не нашёл. Targeted marketing11/0, UI8/0; обязательный `mix precommit` в изолированной test partition прошёл: **1538 tests, 0 failures, 7 excluded**, compile/format/strict Credo clean, лог `/tmp/delivest-f01-preview-queue-precommit.log`. Отдельный UI-тест comparison не добавлялся; тот же форматтер покрыт report summary/daily/discount. Root повторно проверил в браузере отчёт с 13 заказами и `11 340 ₽`. Демо .exs прошли format-check, реальный seed и SQL/HTTP/UI-проверки. F01 исходные PR не merged; новые исправления находятся в ветках демо/preview, прежние PR пока указывают на прежние коммиты. Production не менялся.

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

- Root/server `codex/f01-marketing-policies`; server F01 `7865c5d` + CI fixture fix `591030c`, clean и push подтверждён, PR https://github.com/ShafranovKirill/delivest-ex/pull/31 готов к ревью.
- Client `codex/f01-notifications`: 3e08c77, 5d1dda5, 9f60b3a, canonical generated types `0f0d8ca`; clean, push подтверждён, PR https://github.com/ShafranovKirill/delivest-web/pull/20.
- Agent `codex/f01-optional-deliveries`: 27c94f1; clean, push подтверждён, PR https://github.com/ShafranovKirill/delivest-agent/pull/8. Restore отменяет optional_feature jobs, сохраняет core.
- Зависимая основа уже готова, CI зелёный, не merged: root #34 / server #30 / agent #7. Base server7176fa5 / agent1395fe0 / rootd922829. F01 PR включают эту ещё не слитую основу; интеграция только после ревью владельца.

## Проверки и оставшиеся шаги

- Root финальный `mix precommit` fresh f01accept3_20261110: **1536 tests, 0 failures, 7 excluded**, compile warnings-as-errors / format / strict Credo зелёные. Лог /tmp/delivest-f01-final-precommit3-20261110.log. Dialyzer passed (2 прежних предупреждения штатно исключены, unnecessary skips0); /tmp/delivest-f01-final-dialyzer-20261110.log. Первый прогон1530/20fail был загрязнён unboxed NotificationsConcurrency fixture; cleanup исправлен, оба повторных свежих прогона зелёные.
- Root agent integration + full_backup targeted **25/25**, /tmp/delivest-f01-final-agent-20261110.log. Root client auth7/7 + push10/10; worker typecheck/build зелёные.
- Independent high review: финансовые owner/source fences, frozen cohorts, pause/resume, Report cleaning/comparison locks, manual impact guard, generic disabled role permissions — без открытых замечаний. Reviewer также независимо Report+Notifications15/15 fresh DB. DB finance/completion races2/2 входят в default CI.
- Ручной browser test на изолированной test DB: пять шагов → сохранённый черновик, Back сохраняет сообщение, RU/EN, dark contrast, исключения без UUID. UI worker7/7 regressions, scoped compile/format clean. Временный сервер4402 остановлен после проверки; customer sends не выполнялись.
- Comparison picker pager завершён: следующие страницы по50, выбор сохраняется, тест52политики+скрытая область; UI7/7. Независимые ревью закрыли все найденные замечания. Общий PR https://github.com/ShafranovKirill/delivest/pull/35; актуальный remote CI проверять на нём перед интеграцией.
- Первый remote CI: root server/agent/static/Playwright прошли, client упал на несовпадении повторной генерации типов; standalone server упал на старом ZvonokTest без Sandbox. Исправлены `0f0d8ca` (только canonical generated types, повторная генерация идентична) и `591030c` (только ExUnit.Case→DataCase, targeted5/0 и13/0). Финальный повтор precommit в f01accept4_20261110 и remote CI на новых gitlinks ещё идут на момент коммита; логи /tmp/delivest-f01-final-precommit4-20261110.log.
- Все миграции/проверки строго MIX_ENV=test TEST_DB_HOST=127.0.0.1 MIX_TEST_PARTITION=новое_имя. Старые default/worker partitions могли иметь drift; не использовать и не латать вручную. Root независимо проверил финальные migration24/25 up/down/up в f01schemafinal20261110; OpenAPI JSON совпадает с client snapshot. Schema заморожена.

## Источники

Notion canonical spec: https://app.notion.com/p/41031ec95e4481b5b776d0e5d9b09657 — решения 10 ноября сохранены через notion-knowledge-capture. Локальный старый экспорт docs/tasks/notion-current/features-spec.md не содержит последних уточнений; этот HANDOFF и docs/tasks/F01_ACCEPTANCE.md приоритетнее. Реализация: server/docs/tasks/marketing-report.md, docs/tasks/ADR-BACKGROUND-ORCHESTRATION.md, server/docs/background-features.md. История: docs/tasks/archive/HANDOFF-2026-11-10-foundation.md и HANDOFF-2026-11-10-f01-review.md.
