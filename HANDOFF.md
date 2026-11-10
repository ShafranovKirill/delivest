# Delivest — рабочая выжимка

## Текущая задача

Довести F01 целиком: постоянные маркетинговые политики, мотивации через существующие промо/бонусы, самостоятельные уведомления SMS/Push/витрины и отчётность. Пользователь явно разрешил продолжение, реализацию и промежуточные коммиты. Требует масштабируемой архитектуры без временных обходов; о тупиках сообщать до реализации.

## Ветки и готовая основа

- Root/server: `codex/f01-marketing-policies`, созданы от актуального develop с переносом зависимой готовой основы fast-forward. Предыдущие PR ещё не слиты: [root #34](https://github.com/ShafranovKirill/delivest/pull/34), [server #30](https://github.com/ShafranovKirill/delivest-ex/pull/30), [agent #7](https://github.com/ShafranovKirill/delivest-agent/pull/7). Не менять эти ветки новой F01-работой, не сливать значительную фичу без ревью владельца.
- Основа: server `7176fa5`, agent `1395fe0`, прежний root `d922829`. Segments, feature gates, общий Background/Oban, dirty queue, защита публикации поколением и job owner, сохранение host flags при full restore реализованы. Флаги по умолчанию off, управление host CLI; Bastion transport отдельно.
- Проверено координатором: server precommit 1496 tests / 0 failures / 7 excluded; agent 35/35 с реальной парой scratch DB; migration23 down/up; все remote CI включая Playwright зелёные. Benchmark 1000 клиентов/5 филиалов/5000 заказов/4 группы: чтений истории 20/0/1 (первый/без изменений/один изменённый). Production capacity не подтверждена.

## Неизменные решения

- Установка = франшиза + филиалы, отдельного restaurant нет. Гостевые заказы учитываются; показатели покупок только completed, без deleted, возвраты succeeded уменьшают сумму, частичный возврат сохраняет факт покупки.
- Руководитель франшизы управляет группами сети; филиальный — только своей областью. Platform feature flags только владелец; staff admin не включает их.
- Выключенная функция не планирует/не исполняет расчёты и не собирает необязательные данные. Общие небольшие служебные расходы допустимы. Новые задачи только через готовый оркестратор, без cron на каждую политику/филиал. Суточный пересчёт допустим.
- Политики используют независимые Segments, исключения клиентов/групп, существующий Promo Engine и бонусный ledger. Одна выдача на период неактивности per policy; новый завершённый заказ начинает новый цикл и скрывает старое предложение. Прямое уточнение владельца 10 ноября: «только завершённые … везде» — количество, давность, выручка, цикл и currentness только completed. Незавершённый заказ ничего не меняет; отмена не снимает уникальность выданной награды. Брошенная корзина сама скидку не запускает.
- Первый запуск политики: явный выбор вся текущая подходящая аудитория / только будущие участники, с предварительным охватом/затратами. Изменение используемого сегмента требует списка затронутых политик и подтверждения; история сохраняется.
- Notifications самостоятельны: SMS, Push, карточки под хедером рядом с активным заказом; закрытие вручную только на устройстве, не отменяет награду. Учитывать согласия и доступность каналов. Не выдумывать доставку/прирост продаж; неизвестное показывать явно.
- Владелец подтвердил отдельную клиентскую страницу «Каналы оповещения», добровольные маркетинговые SMS/Push по умолчанию off и предложения на сайте. SMS пока не подключён: интерфейс канала есть, отправки недоступны. Все клиентские оповещения проходят общий Notifications API; transactional/account события сохраняют прежние настройки и не зависят от marketing consent. Закрытие карточки — только текущее устройство.
- F02/F05 исключены из ближайшего объёма. Полная F04, native apps, подписки и billing не входят в F01. Main/deploy не разрешены.

## Источники и продолжение

- Актуальное Notion ТЗ: https://app.notion.com/p/41031ec95e4481b5b776d0e5d9b09657, обновлено 2026-11-10 через notion-knowledge-capture: добавлены решения владельца про completed-only, каналы/согласия/SMS, карточки, оркестратор и роли. Это решения, не статус готовности. Локальный `docs/tasks/notion-current/features-spec.md` содержит прежний экспорт (разделы после строки 480); новые уточнения здесь и в F01_ACCEPTANCE имеют приоритет.
- Основа: `docs/tasks/ADR-BACKGROUND-ORCHESTRATION.md`, `server/docs/background-features.md`, `server/docs/tasks/segments.md`.
- Исследование `f01_map` завершено. Работают `f01_policies` (server Marketing/Promo/Loyalty/Features DAG/Segments impact/staff UI/все server routes, migration24) и `f01_notifications` (server Notifications/consents/API, migration25; client ветка `codex/f01-notifications`, каналы и карточки). Нельзя редактировать файлы другого worker. Корневой контракт: idempotent notice intents в транзакции выдачи, callback Marketing.notification_current?; flags+generic Background only; DAG lock order canonical. Контракты согласуют напрямую. Не повторять общий аудит.
- История предыдущей работы сохранена в `docs/tasks/archive/HANDOFF-2026-11-10-foundation.md`.

## Продолжение 10 ноября — незавершённая реализация

- Активные исполнители после восстановления: `f01_policies_resume` (Marketing/Features/Segments/UI/router/migration24), `f01_notifications_resume` (Notifications/Push/client/migration25; затем agent restore). Reporting ещё требуется: отдельный bounded cache, фильтры, сравнения и история окон атрибуции. Фича не готова, новые F01 PR ещё не созданы.
- Независимо проверено координатором на промежуточном коде: свежая test DB `f01parentaudit20261110`, Features/Background 12/12; Promo order flow/engine + Loyalty/expiry 78/78. Лог второй проверки `/tmp/delivest-f01-parent-reward-regression-20261110.log`. Итоговый precommit не запускался; схема ещё меняется.
- Worker проверил текущие migration24/25 up→down2→up2 на fresh `f01policiesfresh2_20261110`. Не использовать default TEST DB для финальной проверки: там незавершённый rollback старой версии незакоммиченной migration24. Финальные проверки только на новой именованной test DB, `MIX_ENV=test TEST_DB_HOST=127.0.0.1`.
- Выявлены и переданы workers: raw cursor + in_app-only карточки; identity/permission races; durable per-subscription Push fanout без лимита устройств; no blind retry unknown; подписка должна всё ещё принадлежать адресату; live reward currentness; frozen preview request fencing; scope gates runtime; default marketing manage только admin. Независимое ревью ещё предстоит.
- Async бизнес-вопрос закрыт: владелец подтвердил completed-only «везде». `f01_policies_resume` убирает временные placed_since?/Orders.Create activity lock и меняет тесты. Completion lock и unique completed-order cycle остаются. Это уточнение отменяет промежуточную трактовку про немедленную остановку после размещения.
- Notifications/client coherent checkpoint: client commit `3e08c77` (ещё не push). Координатор на fresh `f01parentnotices20261110` независимо проверил Notifications 6/6 + independent DB publication concurrency 1/1; логи `/tmp/delivest-f01-parent-notifications*-20261110.log`. Worker также проверил client build/typecheck, Push regression8/8 и deferred permission1/1. Server код ещё не коммитили из-за общей зависимости.
- `f01_notifications_resume` теперь владеет новым `Marketing.Report`/report tests/report tables в migration24; callback/UI/Registry/Marketing.ex остаются `f01_policies_resume`, контракт согласуют напрямую. После report исправить Notifications: реально отменять ожидающие optional Oban jobs при disable, bounded reconciliation queued terminal/missing jobs до HTTP. Agent restore marker fix ещё НЕ сделан; отдельный code_worker позже, затем независимый reviewer High (finance/concurrency).
- Известная честная граница отчёта: существующий Loyalty.consume уменьшает remaining, expire тоже обнуляет его без связи debit→credit. Точный historical bonus usage/cost per Issue не восстановить; показывать nil с причиной, не выдумывать по разности remaining. Для точности позже нужна generic allocation связь в существующем ledger, не второй баланс.
