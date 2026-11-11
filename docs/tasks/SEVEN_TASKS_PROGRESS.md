# Семь задач UI и операций

Единая сборка с согласованным Header/Sidebar и связанными ветками: [результат от 12 ноября](UNIFIED_STAFF_SHELL.md). Ниже сохранены результаты первой поставки семи задач до объединения UI стека; актуальные SHA и проверки находятся в новом отчёте.

Источник: [Delivest → Development → To Do](https://app.notion.com/p/3e931ec95e44805fb97ac7d80efe6664). Рабочий статус 11 ноября 2026 года; принятые изменения направляются в `develop`, production этим списком не разворачивается.

| Задача | Фактическое состояние |
| --- | --- |
| P6 Пагинация и аудит списков | Принята в develop: server PR №37, root PR №41. [Проверки и границы](P6_PAGINATION.md). |
| P7 Общий dashboard | Server PR №38 принят в develop; root gitlink обновлён. [Результат и проверки](P7_DASHBOARD.md). |
| P3 Цвет скутера | Принята в develop: server PR №39, client PR №21. [Результат и проверки](P3_LOADER_COLOR.md). |
| P1 Принятие цены CRM | Принята в develop: server PR №41. Fresh read, повторное сравнение, аудит и защита филиала. [Результат и граница общих товаров](P1_CRM_PRICE.md). |
| P2 Товарные операции | Принята в develop: server PR №42. XLSX export/import, preview и идемпотентное копирование. [Шаблон, проверки и ограничения](P2_PRODUCT_OPERATIONS.md). |
| P5 Тяжёлые задачи в 03:00 | Принята в develop: server PR №43. Четыре фактические batch-операции, durable local-date scheduling. [Результат и проверки](P5_NIGHTLY.md). |
| P4 Стоп-лист FrontPad | Принята в develop: server PR №45. Ежедневно в 06:00, вручную и по точному product-key отказу. [Контракт, проверки и границы](P4_FRONTPAD_STOPS.md). |

P6: первый отдельный серверный CI-прогон упал в тесте Zvonok из-за завершения владельца sandbox-соединения; повтор того же commit прошёл. Root CI, включая Playwright, прошёл. Исходный старый сценарий невозможности перехода по страницам не воспроизведён; требуемая навигация текущей версии проверена браузером.

Объединённая проверка сервера P1–P7: `ERL_FLAGS='+S 4:4' MIX_TEST_PARTITION=seven_tasks_final mix precommit` — 1542 теста, 0 ошибок, 7 контрактных тестов исключены; format/compile/strict Credo прошли. На отдельной БД миграции 22–24 применены, откачены и применены повторно без ошибок.

Полный Playwright на отдельной чистой БД `delivest_e2e_all_20261111_v2` — **39 passed (3.7m)**, включая новые loader и XLSX/copy round-trip сценарии; `pnpm typecheck` прошёл. В первом полном прогоне было 38 passed / 1 failed: старый delayed-theme тест отпускал API только после mount, а новое P3 поведение ждёт fresh API до mount; он дождался timeout вместо успешного ответа. Тест исправлен на проверку boot до ответа и свежей темы после ответа; затем 12 целевых и все 39 общих сценариев прошли. Production-код ради теста не изменялся.

Итоговые gitlinks: server `832feed1c5dab6d567bfbe931fc3cb7a8aae128f`, client `c4d990550cf02f9a966a1b36f5c6ec91d3043625`. Все feature PR приняты в develop; итоговая интеграция — [root PR №43](https://github.com/ShafranovKirill/delivest/pull/43). GitHub CI для последних server PR №44–46 и root PR №43 остаётся в очереди без запущенных jobs; изменения принимаются на основании локальных полных проверок и независимого review. Этот статус не считается успешным CI.

Дополнительные корневые gates: client auth 7/7, regression 42/42 и ESLint прошли; OpenAPI snapshot и generated client types совпали. Dialyzer выявил недостижимую else-ветку XLSX decoder; [server PR №46](https://github.com/ShafranovKirill/delivest-ex/pull/46) удалил ровно одну строку без изменения rescue/catch. После исправления полный precommit снова прошёл: 1542 теста, 0 ошибок, 7 исключены. Главный агент независимо повторил 18 XLSX-тестов и Dialyzer — exit 0; два существующих ignore остались без изменения.

Два найденных старых источника нестабильности тестов исправлены отдельно: Zvonok использует владельца SQL Sandbox ([server PR №40](https://github.com/ShafranovKirill/delivest-ex/pull/40)); login в password-тесте получает уникальный ID вместо случайного числа из 1000 вариантов ([server PR №44](https://github.com/ShafranovKirill/delivest-ex/pull/44)).

Границы готовности: у общих товаров цена по существующей модели глобальна, поэтому P1 явно отказывает в её принятии для одного филиала. В P4 подтверждённый контракт — отказ `invalid_product_keys`, отдельный код отсутствия товара на складе не подтверждён. P5 переносит существующие batch-задачи; отсутствующие в develop модули сегментов/маркетинга не создавались. Реальные провайдеры, production и rollout не проверялись и не разворачивались.
