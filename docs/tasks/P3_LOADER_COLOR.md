# P3 — цвет скутера при загрузке

[Server PR №39](https://github.com/ShafranovKirill/delivest-ex/pull/39) и [client PR №21](https://github.com/ShafranovKirill/delivest-web/pull/21) приняты в `develop`.

Ранний loader использует актуальный light/dark цвет и default theme из синхронного SSI SEO head. При отсутствии SSI скутер скрыт до получения настроек; нейтральная анимация остаётся. Устаревший localStorage больше не определяет первый видимый цвет. Приложение ждёт свежую франшизу даже при кеше, а при ошибке API сохраняет кеш. Искусственная яркость тёмного скутера убрана.

Источник темы остался франшизным: отдельного branch color в текущей модели нет. Некорректные CSS-значения отвергаются.

Проверки: клиентские Vitest 2/2, typecheck, ESLint, Prettier check и build прошли; server `mix precommit` — 1467 тестов, 0 ошибок, 7 исключены. Главный агент независимо повторил unit 2/2, typecheck, SEO 5/5 и Playwright 7/7. Браузерный gate удерживает API до проверки первого видимого кадра: cold/stale cache, light/dark, отсутствие SSI, unsafe color, deep link, переключение филиала и reload. Второй филиал подставляется через API mock; SEO head и franchise API реальные. Разные light/dark значения дополнительно проверены серверным тестом, browser seed использует dark fallback.

Первый отдельный серверный CI упал в старом Zvonok test setup без Sandbox owner. [Исправление №40](https://github.com/ShafranovKirill/delivest-ex/pull/40) принято отдельно; после обновления базы ветки CI P3 прошёл.
