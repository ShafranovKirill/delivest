# S2 — identity, ACL, frontend

## База и границы

Работа начата 6 ноября 2026 года в `codex/refactor-s2` от актуальных `origin/develop`: root `e59e292`, server `bdf31af`, client `c25b194`. Перед началом выполнен fetch, чужих незакоммиченных изменений не было. Server и client — отдельные репозитории; их коммиты публикуются до обновления gitlinks.

S1 уже merged: [server PR №19](https://github.com/ShafranovKirill/delivest-ex/pull/19) и [root PR №18](https://github.com/ShafranovKirill/delivest/pull/18), remote checks обоих PR успешны. Это подтверждает merge, но не production rollout.

Scope S2: D05/D08, C01–C10 и ранний triage O05. Полный offline, RN, смена схемы хранения токенов и deployment не входят в этот блок. Открыты [server PR №21](https://github.com/ShafranovKirill/delivest-ex/pull/21) и [client PR №14](https://github.com/ShafranovKirill/delivest-web/pull/14); [root PR №20](https://github.com/ShafranovKirill/delivest/pull/20) открыт.

## C01 и исходный PR

На старте [client PR №13](https://github.com/ShafranovKirill/delivest-web/pull/13) открыт, merge отсутствует. Его commit `89b7e05987168c0e991a6cbc71a1f6a17f12797b` перенесён в S2 cherry-pick как `0293f7a`. Это включение кода в рабочую ветку, а не подтверждение доставки исходного PR или deployment.

### Решение о владении заказом

Browser/Phoenix проверка выявила дополнительный C01 риск: прежний предикат `session_id OR client_id` позволял после A → logout → B читать/оплачивать/отменять заказ A через прежнюю browser session; такое же правило применялось к active orders и уведомлениям. Просто ограничить session access заказами с `client_id IS NULL` нельзя: guest create автоматически связывает контактный Client по телефону для loyalty/history.

Решение: отдельный server-controlled `guest_session_access` на Order. Новый public guest order получает true; authenticated и внутренние пути — false. Доступ проверяет verified client ID либо явный guest session access. Уведомления используют тот же инвариант. Поле не должно приниматься из пользовательского payload.

Миграция `20261210000015` безопасно разрешает session access старым заказам только при `client_id IS NULL` и наличии session ID. Исторические auto-linked guest и authenticated orders по прежним данным неразличимы, поэтому для legacy заказа с `client_id` требуется вход связанного клиента. Это намеренное ограничение совместимости в пользу приватности, без изменения contact/loyalty связи. До полного rollout старые readers сохраняют старый OR predicate; их нужно завершить. Downgrade возвращает прежнее privacy-поведение и требует отдельного review.

Отдельный WebPush путь также требует смены владельца: подписка `order_id + endpoint` раньше переживала logout. DELETE `/client/push` теперь транзакционно удаляет client subscription A и все принадлежащие A order subscriptions заданного endpoint, включая завершённые заказы. Client B не может удалить A subscriptions, повторный DELETE идемпотентен. Client lifecycle с блокировкой старого service worker и callback guards проверяется отдельно.

## O05: ранний triage

- Browser access/refresh tokens persist-ятся в клиентском storage. Это повышает последствия XSS; исправления гонок сессии не заменяют CSP, аудит исполнения стороннего кода и отдельное решение о storage. Смена на HttpOnly cookies требует отдельного API/CSRF/migration design. RN secure storage остаётся отдельным native проектом.
- Agent Bastion помещает credential в query string WebSocket URL. Подтверждено чтением кода; попадание действующих credentials в proxy/application logs не подтверждено. Для полного закрытия нужны конфигурация и доступ к логам целевого окружения с проверкой redaction без копирования значений в отчёт.
- Значения, похожие на секреты, в исходной Notion-странице не копировались. Их актуальность, использование и необходимость ротации не установлены в этой сессии. При подтверждении действующих секретов требуется ротация у владельца соответствующего окружения.

O05 остаётся открытым в S5: ранний triage выполнен, компрометация и ротация не заявляются.

## Проверки и приёмка

### Первоначальный серверный gate D05/D08

Server head `b473d0d`: D05 проверяет `integrations.update` и филиал в actor-aware CRM/iiko functions; read-only Яндекс Еда не запускает async загрузку пауз. D08 использует PostgreSQL advisory transaction locks по нормализованному телефону и session ID в стабильном порядке. Reservation записывается до provider call; обычный provider failure сохраняет учтённую попытку без возможности подтвердить её, неожиданный exception откатывает транзакцию. Активное подтверждение той же сессии переиспользуется. Миграций нет; гарантия сериализации требует завершения старых writers при rollout. Rollback не удаляет историю попыток.

- Worker targeted ACL/concurrency: **56/0**; отдельные DB connections, bounded message barrier вместо sleep.
- Worker `mix precommit`: **1362/0 (7 excluded)**, Credo 0 issues, seed `864585`, `/tmp/delivest-s2-worker-precommit-final.log`. После этого добавлен только `render_async` в negative test; isolated test **1/0**.
- Независимый финальный full suite главного агента: `MIX_ENV=test MIX_TEST_PARTITION=s2_20261106_main_final TEST_DB_HOST=127.0.0.1 mix test --seed 817005` — **1362/0 (7 excluded)**, 55.6 s, `/tmp/delivest-s2-main-final.log`.
- Независимые `mix format --check-formatted`, test compile with warnings-as-errors, `mix credo --strict`, `git diff --check` — exit 0; `/tmp/delivest-s2-main-static.log`. Test Dialyzer exit 0, 2 существующих skipped errors, `/tmp/delivest-s2-main-dialyzer.log`.
- Первые прогоны не были зелёными: unboxed tests оставляли Zvonok diagnostic rows (cleanup исправлен); IndexTest вызывал side effect read-only actor (fixture изменён на editor); YandexEda async mount обходил ACL (исправлен). Worker seed `82391` упал на Cart Cachex nil; main seed `817005` — на Kitchen ready notification с logged order channel uniqueness conflict. Одиночные сценарии прошли **1/0** и **5/0**; точная причина этих двух падений не доказана. Финальный main full suite с тем же seed `817005` прошёл. Первый main лог `/tmp/delivest-s2-main-review.log`, isolated kitchen `/tmp/delivest-s2-main-kitchen-repeat.log`.

### Итоговый серверный gate с C01

Server head `58e8436`, включая `7c59a62` (owner marker/REST/events), `3637464` (push cleanup), `58e8436` (dummy E2E provider). Два новых regression tests воспроизвели REST detail **200 вместо 404** для B и получение B socket события A до исправления; после исправления related server **90/0**, окончательный targeted C01/push **38/0**.

- Worker `MIX_TEST_PARTITION=s2_20261106_worker mix precommit` — **1366/0 (7 excluded)**, seed `350067`, `/tmp/delivest-s2-worker-c01-precommit-final2.log`.
- Независимый final main `MIX_ENV=test MIX_TEST_PARTITION=s2_20261106_identity_main_final TEST_DB_HOST=127.0.0.1 mix test --seed 817005` — **1366/0 (7 excluded)**, 64.5 s, `/tmp/delivest-s2-main-identity-final.log`.
- Независимые format/compile/strict Credo и test Dialyzer exit 0, 2 существующих skipped errors; `/tmp/delivest-s2-main-identity-{static,dialyzer}.log`.
- Реальный migration probe: отдельная `delivest_tests2_20261106_migration_probe`, миграции до 14 → три legacy rows → миграция 15. Главный агент независимо выполнил SQL SELECT: S2P-1 (`client_id NULL`, session есть) → true; S2P-2 (linked client, session есть) → false; S2P-3 (client и session NULL) → false. Worker script `/tmp/delivest_s2_migration_probe.exs`. Стандартные БД не сбрасывались.

### Клиент и браузер

Client head первоначального client gate `8a2fdb9` (пять коммитов от cherry-pick `0293f7a`). C02 защищает lifecycle phone attempt и socket по generation/epoch. C03 отделяет fulfillment по владельцу в session storage, удаляет legacy local storage и owner-less checkout draft, очищает открытый address editor и PII формы при смене личности. Guest → первый login сохраняет явно выбранный адрес текущей вкладки; после закрытия вкладки выбор не сохраняется. C04 сериализует мутации и отклоняет ответы прежнего поколения, включая A → B → A. C05 убирает stale quote и запрещает checkout при pending quote. C06–C10 исправляют навигацию, клавиатуру, ошибки/повтор, timezone/DST и честную индикацию доступности сети.

- Независимые `pnpm test:auth` — **7/7**, `pnpm test:regression` — **15/15**, `pnpm build`, `pnpm exec eslint .`, `git diff --check` — exit 0. Логи `/tmp/delivest-s2-main-client-{auth,regression,build,eslint}.log`.
- Worker browser gate `CI=1 DEV_DATABASE=delivest_s2_e2e_20261106`: существующие checkout и S2 UI **11/11**, `/tmp/delivest-s2-e2e-clean.log`. Первые новые тесты имели неверные UI selectors, исправлены. Отдельный повтор под старым preview использовал перезаписанный build с другим API origin; это выяснено по trace, финальный gate запускал fresh CI webservers и правильный origin.
- Независимый root `e2e/pnpm typecheck` — exit 0, `/tmp/delivest-s2-main-e2e-typecheck.log`.
- Browser/Phoenix C01 identity scenario после marker migration прошёл у worker: A → logout → B, history/active/detail/address и delayed socket token. C03 дополнительный browser сценарий и WebPush lifecycle follow-up проверены в финальном gate ниже.

Production-provider проверки и deployment не выполнялись.

### Финальный клиентский gate и WebPush

Client final head `655d365`. Перед auth boundary устанавливается persistent push block и закрываются показанные уведомления. Privacy-aware active worker подтверждает блокировку; при legacy worker без ack приложение ждёт фактический unsubscribe, закрывает уведомления повторно и удаляет прежнюю registration. Неуспешная защита не разрешает смену личности; интерфейс показывает ошибку. Новый endpoint ждёт cleanup, blocked старый endpoint не переиспользуется даже после reload. Блокировка снимается после успешной новой серверной регистрации. Старые callbacks и сохранённые order IDs имеют owner/epoch guards. Captured-token cleanup выполняется отдельным HTTP client без автоматического refresh B.

Независимые финальные main `pnpm test:auth` **7/7**, `pnpm test:regression` **25/25** (7 файлов), `pnpm build`, `pnpm exec eslint .`, `git diff --check` — exit 0. Логи `/tmp/delivest-s2-main-client-final-{auth,regression,build,eslint}.log`. Build сообщает существующее предупреждение о chunks >500 kB; это не ошибка сборки. Live WebPush provider delivery не проверялся; lifecycle/failure/SW поведение покрыто детерминированными mocks и исполнением SW handler в тестах.

Полный финальный Playwright suite на server `58e8436` + client `655d365`: `CI=1 DEV_DATABASE=delivest_s2_e2e_20261106 pnpm exec playwright test` — **27/27**, 2.5 min; `/tmp/delivest-s2-worker-playwright-full-final.log`. Включены существующие admin/POS/delivery/pickup/checkout и новые S2 UI **6/6**, identity **2/2**. Главный агент просмотрел итоговый diff, тесты и реальный лог. Root `e2e/pnpm typecheck` прошёл. Более ранние попытки были остановлены при пересечении builds (exit 130) и занятых портах (exit 1); они не считаются успешными, финальный чистый прогон стартовал свои webservers с правильным API origin.

**Локальная приёмка S2 завершена: код готов к review/merge.** D05/D08/C01–C10 — implemented-local; O05 early triage выполнен, основной S5 открыт. Remote CI/review, merge и rollout фиксируются отдельно.

После завершения всех прогонов удалены шесть созданных S2 БД: worker, main_review, main_final, identity_main_final, migration_probe и dedicated E2E. Перед удалением активных соединений не было; стандартные dev/test БД и локальные пользовательские стенды не затронуты. Все логи `/tmp/delivest-s2-*` сохранены.

## Delivery и remote CI

[root PR №20](https://github.com/ShafranovKirill/delivest/pull/20) содержит gitlinks server `b24501d` и client `655d365`, CI и browser regressions. Server PR №21 прошёл remote Build/Test/Lint на первоначальном head; новый test-only follow-up перепроверяется CI. Client repository отдельных checks не публикует, client gates запускаются root workflow. Текущий root CI/review статус смотреть в PR. Merge: server/client в develop, затем root; deployment отдельно.

### Root CI: воспроизведение и исправление fixture collision

Root run `42239023240` на `eb17af9` прошёл client/agent и Playwright, но server завершился **1366/1** (seed `695615`, max_cases 8). `PushControllerTest` упал на `clients__phone__uk`: прежняя client factory при sequence 112 генерировала тот же телефон, что и фиксированные checkout fixtures. Main воспроизвёл **то же падение** в отдельной CI-review БД с `ERL_FLAGS='+S 4:4' ... mix test --seed 695615 --max-cases 8`, `/tmp/delivest-s2-main-ci-repro.log`; точный concurrency origin не заявляется.

Test-only server commit `b24501d` меняет factory phone на отдельный валидный диапазон `+7888` + семь цифр sequence. Production constraints/поведение не менялись. На том же seed/config main repeat — **1366/0 (7 excluded)**, 91.0 s, `/tmp/delivest-s2-main-ci-fixed.log`; worker exact repeat **1366/0**, затем `mix precommit` **1366/0**, Credo 0 issues, seed `286989`, `/tmp/delivest-s2-worker-ci-{seed695615,precommit}.log`. Дополнительные CI-review/CI-worker БД также удалены после завершения прогонов; всего создано и очищено восемь S2 test DB. Новый root/server CI запускается на этом fix.
