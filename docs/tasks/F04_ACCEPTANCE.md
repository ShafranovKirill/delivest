# F04 — первый блок capture, 11 ноября 2026

## Принятые решения

- Подробные raw события хранятся 90 дней. Сессия заканчивается после 30 минут бездействия.
- Сбор выключен по умолчанию и управляется host feature `analytics_funnel` на франшизе и филиале. При выключении нет записи raw событий/сессий и нет заданий расчёта аналитики. Физическая очистка уже записанных raw работает через штатную maintenance очередь и при выключенном сборе.
- Клиентские события ограничены: `visit`, `menu_view`, `product_view`, `cart_add`, `checkout_start`, `fulfillment_selected`. Сервер определяет owner, receipt time и session ID. Гость использует отдельную подписанную cookie. Один event UUID в пределах branch/owner повторно возвращает исходную сессию.
- UTM source/medium/campaign — короткие непроверенные метки клиента. Они не подтверждают рекламный источник. Суммы, `created`/`paid`/`completed` и другие результаты заказа не принимаются от браузера.
- Для выручки и активности учитываются только `completed` заказы. `created` и `paid` остаются отдельными состояниями.

## Реализованный первый блок

Сервер: миграция 28, закрытый по умолчанию gate, `POST /client/analytics/events`, флаг `branch_info.analytics_funnel_enabled`, сессии с idle timeout, dedupe и bounded maintenance retention. Клиентский слайдер готов в `fac6600`, capture в `3c72d59`. Первый capture блок принят главным агентом; вся F04 ещё не завершена.

## Следующие блоки

Серверная привязка lifecycle/order, подтверждённая атрибуция и окно, immutable first source покупателя, агрегаты за 36 месяцев, dashboard и рекламные ссылки. Численный Push limit, атрибуционное окно и pilot capacity остаются открытыми. Не назначать значения без решения владельца.

## Основа и проверки

Ветка основана на проверенном F01 стеке, ещё не merged в `develop`. Пользовательские/demo/production базы и paused policy не менялись. Проверки выполнялись только на изолированных `MIX_ENV=test TEST_DB_HOST=127.0.0.1 MIX_TEST_PARTITION=...` базах. Миграция 28 прошла `up/down/up` в partition `f04capture20261111`. Final targeted API и maintenance: **11 tests, 0 failures**, лог `/tmp/delivest-f04-final-targeted.log`; strict Credo: 0 issues, лог `/tmp/delivest-f04-credo-final.log`.

Финальный полный `mix precommit` на свежей partition `f04finalgate20261111`: compile warnings-as-errors, format, strict Credo прошли; **1601 tests, 0 failures (7 excluded)**, exit 0, лог `/tmp/delivest-f04-final-precommit.log`. До этого существующий staff `CommandPaletteTest` не находил клиентов по английскому `cli` при русском literal label. Отдельное исправление `297ad86` использует существующий `gettext("Clients")` и проверяет поиск `cli`/`кли` в обеих локалях.

Главный агент самостоятельно проверил server diff/new files и свежую test partition: primary API/Phone/Features **16/0**; затем API/palette с `--seed 0` **14/0**, exit 0, лог `/tmp/delivest-f04-root-final-tests.log`. Независимые клиентские проверки: regression **55/55**, auth **7/7**, typecheck green. Первый capture блок принят. Ограничения проверки: живой client→HTTP E2E и отдельный двухсоединительный SKIP LOCKED drill не выполнялись; pilot capacity не измерялась. Эти ограничения не означают приёмку всей F04.
