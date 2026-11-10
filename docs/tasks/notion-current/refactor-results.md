# Delivest — аудит рефакторинга S1–S5 и результаты · 7 ноября 2026

Источник: https://app.notion.com/p/41131ec95e4481ec89a9f31cac4b2479?pvs=204

Получено: 2026-11-10. Последнее изменение страницы: 2026-11-07T06:54:23.614Z.

Снимок Notion; статусы отражают источник, а не новую проверку кода.

<b>Статус:</b> кодовый объём S1–S5 реализован, проверен и слит в <code>develop</code>. Все три итоговых PR merged. Финальные Checks и E2E на root <code>0feed9b</code> прошли. Внешняя и эксплуатационная приёмка остаётся открытой; production rollout не выполнялся. Пользователь подтвердил отсутствие sandbox-доступов и поручил завершить доступную часть.

Дата фиксации: <date start="2026-11-07" /> (Europe/Moscow).

## Итог поставки

| Репозиторий | PR в develop | Merge commit |
| --- | --- | --- |
| Основной проект | [№25](https://github.com/ShafranovKirill/delivest/pull/25) | <code>c673277b66001223243eb6569aee7076efee033d</code> |
| Сервер | [№26](https://github.com/ShafranovKirill/delivest-ex/pull/26) | <code>ed613c62032cea9c694a3209aafa02aa23f2ca0c</code> |
| Клиент | [№17](https://github.com/ShafranovKirill/delivest-web/pull/17) | <code>0b140d08bd4ed59b7f8ebb636ca85582b1df7403</code> |

[Финальные Checks — SUCCESS](https://github.com/ShafranovKirill/delivest/actions/runs/42347202415) · [Playwright — 28/28](https://github.com/ShafranovKirill/delivest/actions/runs/42347202410).

Проверенный root до merge: <code>0feed9b389b468c6e6a5e306741f8e4df3b6de71</code>. Gitlinks: server <code>2ae31664f38b22daacb500f595d606db195fd648</code>, client <code>634ec436f7ba993f38f156b5d65960810a08d3dc</code>, agent <code>962df0d555b1961ee82499aa7fddb650aa5466eb</code>. Коммиты сервера и клиента входят в соответствующие develop merge; рабочие деревья после поставки чистые.

## Что дали изменения

- Усилена изоляция филиалов и проверка прав в бизнес-операциях; приватные cache/socket/draft привязаны к текущей identity.
- Атомарное создание заказа, idempotency key/fingerprint и ревизия корзины защищают от повторного запроса и устаревшего оформления.
- Порядок событий, подтверждения доставки и CRM-команды сохраняются в БД. Для неопределённого внешнего результата есть операторская сверка и аудируемое восстановление.
- Платёжные обработчики вынесены в отдельную очередь с ограниченным ресурсом.
- В сравнимом локальном профиле <b>36→28 SQL/заказ (−22,2%)</b>, p95 <b>34,29→23,73 мс</b>.
- Карта и панели получения заказа загружаются при открытии picker. Отсутствие загрузки в idle и повторное открытие подтверждены браузерным тестом; выигрыш в размере/времени отдельно не измерен.
- Backup/restore и выпуск образов получили блокировки, recovery, manifest и проверки до публикации релиза.

## Результаты по этапам

| Этап | Результат |
| --- | --- |
| S1 — каталог, pricing, cache | Филиальная принадлежность каталога/CRM ID, точные права импорта, безопасный CSV, request-scoped snapshot и persisted catalog version. |
| S2 — identity, ACL, клиент | Сериализация phone/session, owner checks, identity/epoch guards и защита от stale ответов. |
| S3 — заказ, деньги, события | Атомарный checkout, idempotency/revision, конкурентные инварианты, durable push; completion добавил порядок Events, recovery и CRM ledger. |
| S4 — интеграции, аналитика | Бюджеты stop/DaData/polling, явная incomplete выборка, capability/audit адаптеров, ограниченные отчёты. |
| S5 — эксплуатация | Crash-safe agent lock, recovery backup jobs, restore drill, release gates, CI, bounded maintenance и изолированная нагрузка. |

## Подробный результат по областям

| Область | Подтверждённый результат в <code>develop</code> | Дополнение в ветке completion и граница |
| --- | --- | --- |
| Каталог, филиалы и ACL | Shared Product/Category проверяются по всем филиалам; stop и CRM ID ограничены филиалом; импорт проверяет точные права; definition modifier и branch article разделены. Menu/export не раскрывают чужой товар. | Историческая миграция требует координированной остановки старых writers. |
| Identity и клиентский checkout | Phone/session сериализованы в PostgreSQL; доступ к заказу привязан к владельцу. Клиентские private caches, socket и draft привязаны к identity/epoch; stale quote и старые ответы не могут подтвердить checkout. Проверены клавиатура, retry ошибок и timezone. | Ручная проверка screen reader и полный React Native lifecycle остаются отдельно. |
| Заказ и деньги | Owner-scoped idempotency key/fingerprint, cart revision и атомарное создание заказа; branch/courier и payment selection сериализованы. Push delivery имеет durable per-device статус и retry. | Completion переводит пакетные операции из трёх LiveView на единый use case и версионирует канал заказов. Внешний provider outcome требует sandbox проверки. |
| События и очереди | S3 усилил существующие Events/Oban атомарностью и отдельными доставками, добавил базовую изоляцию очередей. | Completion добавляет транзакционный sequence counter, delivery ledger, per-aggregate/subscriber lock, DB ack и audit manual retry/resolve. CRM получил durable outbound command ledger и сериализацию; fiscal fault test покрывает гибель после принятия ATOL. Это не даёт exactly-once внешнего HTTP; платежи используют стабильные idempotency keys. Порядок дочерних jobs и live-provider outcome имеют отдельные границы. |
| Интеграции, аналитика | Бюджеты остановок, DaData и polling; явная incomplete выборка; capability и аудит внешних адаптеров; ограниченные отчёты. | Live-provider contract и операторские sandbox сценарии не выполнены. |
| Ops, backup, release | Agent flock и claimed-job recovery; digest/manifest до tag/release; main/develop checks/e2e, безопасный nginx URI log, bounded loyalty/media retry. Restore drill в изоляции прошёл. | Runtime secret inventory/rotation, production capacity и полный fault/pilot остаются открыты. |

## Проверки и измерения

- S1–S5 checkpoints содержат реальные локальные команды и результаты; S5 server <code>mix precommit</code> — 1421/0 (7 excluded), agent — 96/0, Playwright — 27/27. S5 remote Checks <code>42342496724</code> и E2E <code>42342496753</code> завершились SUCCESS; root PR №24 merged (<code>f85fa05</code>). Это проверка S5 SHA, не итогового completion head.
- S5 frozen exploratory 100/500/1000 сессий по 120 секунд прошёл для узкой guest/pickup/cash смеси. Это не 30-минутная stable нагрузка, не ≥2-часовой soak, не production capacity. Исходные p95 и ограничения — [load results](https://github.com/ShafranovKirill/delivest/blob/c673277b66001223243eb6569aee7076efee033d/docs/runbooks/load-results-2026-11-07.md).
- Completion frozen exploratory load на новом runtime: ступени <b>100/500/1000</b> сессий по 120 секунд прошли короткий gate без technical/business/429 ошибок. P95 menu <b>44,28/61,91/70,53 мс</b>, cart <b>45,62/64,94/73,00 мс</b>, order <b>65,80/72,55/81,16 мс</b>; 50 guest pickup/cash orders/min в каждой ступени. Raw JSON, telemetry и ограничения — [completion load results](https://github.com/ShafranovKirill/delivest/blob/c673277b66001223243eb6569aee7076efee033d/docs/runbooks/load-results-2026-11-07-completion.md). Это отдельный короткий прогон на новом коде, не замена полного N02.
- R06: исторический профиль S1 сократил checkout с 36 до 32 SQL/заказ. Сравнимый замер completion до пакетной постановки jobs дал <b>36 SQL/заказ</b>: два события на заказ добавили по counter UPSERT и вставке deliveries. После <code>ece18a3</code> — <b>28 SQL/заказ</b>, p50 <b>17,50 мс</b>, p95 <b>23,73 мс</b> против до batch p50 <b>24,79 мс</b>, p95 <b>34,29 мс</b>. Профиль: 5 филиалов, 50 warmup + 250 измеренных заказов, 10 конкурентных запросов, <code>ERL_FLAGS='+S 4:4'</code>; 300 заказов сохранено. Итого −22,2% SQL относительно исходных 36 и −12,5% относительно S3 32. Новый ledger, транзакционность и уведомления очереди сохранены; bulk убрал N отдельных unique job lookups/insert round trips. Это один локальный микропрофиль, не замер production capacity. Логи <code>/tmp/delivest-completion-order-bench.log</code> и <code>/tmp/delivest-completion-order-bench-batch.log</code>.
- Completion Events: адресные тесты <b>14/0</b> на <code>MIX_TEST_PARTITION=r03events</code>, включая независимые соединения для порядка writers и kill до commit; отдельная миграционная проба восстановила completed → delivered, cancelled → pending и не создала ряд для pruned job. Логи <code>/tmp/delivest-events-final-tests.log</code> и <code>/tmp/delivest-events-migration-drill.log</code>. После устранения асинхронной задержки освобождения DB lock тест конкурентности прошёл по пяти seed (<b>2/0 каждый</b>), <code>/tmp/delivest-events-concurrency-repeat.log</code>.
- Completion Fiscal: fault-тест на <code>MIX_TEST_PARTITION=r03fiscal</code> прошёл в составе <code>fiscal_test.exs</code> (<b>16/0</b>). Тестовая модель ATOL сохраняет принятую регистрацию между гибелью worker и повтором: тот же <code>external_id</code> запрошен дважды, принят один раз, локальный чек остаётся одним. Лог <code>/tmp/delivest-fiscal-completion-tests.log</code>. SQL sandbox в этом тесте не доказывает откат независимой DB-транзакции; live ATOL не проверялся.
- Completion CRM <code>b5fc7e0</code>: durable команды и первичная синхронизация; адресные тесты <b>18/0</b>, независимый crash regression <b>1/0</b>, legacy backfill completed/scheduled/discarded проверен. Логи <code>/tmp/delivest-crm-completion-tests.log</code>, <code>/tmp/delivest-crm-independent-race.log</code>, <code>/tmp/delivest-crm-legacy-drill.log</code>. Это DB/Req.Test доказательства, не live-provider приёмка.
- Completion server <code>1217e24</code>: главный агент независимо запустил <code>MIX_TEST_PARTITION=completion_20261107 TEST_DB_HOST=127.0.0.1 mix precommit</code> — <b>1446/0 (7 excluded)</b>, exit 0, <code>/tmp/delivest-completion-server-precommit.log</code>. Первый полный прогон дал <b>1446/12</b> (<code>/tmp/delivest-completion-server-precommit-first.log</code>): 11 тестов требовали дренировать отдельную payments queue, один ждал освобождения соединения после kill; исправления <code>1217e24</code>/<code>d2c8c5a</code> включены в зелёный повтор.
- После этого gate коммит <code>ece18a3</code> пакетно ставит jobs новых событий. Адресные Events <b>14/0</b> и Payments/online fiscal <b>8/0</b>, компиляция с warnings-as-errors прошли; логи <code>/tmp/delivest-events-batch-tests.log</code>, <code>/tmp/delivest-events-batch-payments-tests.log</code>. Главный агент повторил полный <code>mix precommit</code> на <code>ece18a3</code> — <b>1446/0 (7 excluded)</b>, exit 0, <code>/tmp/delivest-completion-server-precommit-batch.log</code>. После исправления test helper на server <code>2ae31664f38b22daacb500f595d606db195fd648</code> полный <code>mix precommit</code> — <b>1447/0 (7 excluded)</b>, <code>/tmp/delivest-r03-events-helper-precommit.log</code>; независимый повтор seed <code>142986</code>, max-cases 8 — <b>37/0</b>, <code>/tmp/delivest-completion-main-helper-review.log</code>.
- Completion client <code>634ec43</code>: auth <b>7/7</b>, regression <b>30/30</b>, build и ESLint прошли на итоговом локальном SHA; логи <code>/tmp/delivest-completion-client-{auth,regression,build,eslint}.log</code>. Map pane загружается при открытии picker; эффект на размер/время загрузки ещё не измерен.
- Runtime load freeze: root <code>c8fab886ee541ca150c0bf593818a5f10ebfd03f</code>, server <code>ece18a380564ed2d34c7d417135abce71815f087</code>, client <code>634ec436f7ba993f38f156b5d65960810a08d3dc</code>, agent <code>962df0d</code>. Финальный кодовый root <code>a5429ac78e7baa56500dbd23793a096a60b1dc11</code> указывает на server <code>2ae31664f38b22daacb500f595d606db195fd648</code> и тот же client <code>634ec43</code>; runtime-path после load не менялся. История CI: <code>42345228060</code> Checks SUCCESS, <code>42345228056</code> E2E FAILED из-за production asset predicate; затем на <code>c8fab88</code> Checks <code>42345888549</code> FAILED (loyalty 1446/1, seed <code>142986</code>), E2E <code>42345888560</code> FAILED (map chooser reopen и flaky POS retry). Исправления проверены локально: independent helper repeat <b>37/0</b>, production-preview map reopen <b>1/1</b> за 17,8 с, typecheck exit 0 (<code>/tmp/delivest-map-reopen-target.log</code>). Реальный путь повторного открытия: cart → checkout → «Адрес не выбран» → radio «Самовывоз». После этого на финальном root <code>0feed9b389b468c6e6a5e306741f8e4df3b6de71</code> Checks <code>42347202415</code> и E2E <code>42347202410</code> завершились SUCCESS: сервер <b>1447/0 (7 excluded)</b>, Playwright <b>28/28 без повторов</b>. Затем server/client/root PR слиты в develop.

## Открытые условия приёмки

1. <b>Completion code gate — выполнен:</b> главный агент проверил итоговый diff и реальные результаты; локальные проверки, независимый повтор seed и финальные remote Checks/E2E прошли; все три PR слиты в <code>develop</code>. R01 завершён на уровне кода; R03/R04 сохраняют внешние проверки provider/очередей. R08 имеет реализованный контракт и ADR совместимости; RN-приложение вне scope.
2. <b>Provider и интерфейс:</b> sandbox CRM/fiscal/payment/push unknown outcome и ключей повторов; ручная screen reader проверка. Отсутствие учётных записей/стенда у этой сессии не превращается в успешный результат.
3. <b>Ops и нагрузка:</b> runtime secret inventory/rotation и старые логи; N02 warmup, 30-мин stable, spike, ≥2-часовой soak, три повтора с полной смешанной нагрузкой; pool saturation/backlog и production capacity; N04 fault recovery и pilot. Одиночная нода — текущая эксплуатационная предпосылка: O06 distributed cache/limiter становится gate при переходе к нескольким нодам.
4. <b>Отдельные решения:</b> R05 завершён ADR синхронной payment initialization; async реализация зависит от измерений и согласования lifecycle, не является обязательным условием текущего закрытия. Production rollout выполняется отдельно из <code>main</code> после release gates. React Native приложение и F01–F10 не входят в этот рефакторинг.

## Финальный короткий нагрузочный прогон

Пять филиалов, 1000 товаров (100 с модификаторами), 15 промо. Каждая ступень: 120 секунд измерения и около 10 секунд drain; think time 10 секунд, 80% menu / 20% cart, отдельно 50 guest pickup/cash orders/min. Одна фикстура, прогретый cache, приложение и генератор на одном локальном хосте; отдельная БД <code>delivest_s5_load_20261107</code>, loopback <code>127.0.0.1:4200</code>.

| Сессии | Всего запросов | p95 menu, мс | p95 cart, мс | p95 order, мс | Заказов внутри 120 с | Technical / business / 429 |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | 1333 | 44,28 | 45,62 | 65,80 | 100 | 0 / 0 / 0 |
| 500 | 6106 | 61,91 | 64,94 | 72,55 | 100 | 0 / 0 / 0 |
| 1000 | 12066 | 70,53 | 73,00 | 81,16 | 100 | 0 / 0 / 0 |

Пороги: p95 menu ≤200 мс, cart ≤300 мс, order save без ожидания провайдера ≤500 мс; technical errors \<0,1%. Все три коротких gate прошли. На 500 сессиях с учётом drain завершён 101 order flow, внутри активного окна — 100.

Суммарное DB queue time на 1000 сессий — 247,56 с по грубым 5-секундным snapshots. Это основание для последующего профилирования, а не измеренная доля насыщения pool. Короткие снимки не доказывают устойчивость памяти или backlog.

Нагрузка не включала login/account, delivery, loyalty, online payment, sockets, provider faults, cold-cache spike и modifier checkout. Полный N02 требует 5 мин warmup, 30 мин stable, 5 мин spike, ≥2 ч soak и три сравнимых повтора с полной смесью.

## Условия миграции и восстановления

- Миграции Events/CRM ledger 20/21 выполнять с согласованной остановкой старых writers и workers. При откате приложения сохранять расширенную схему.
- Backfill использует сохранившиеся Oban jobs; удалённая историческая работа автоматически не переигрывается. Строгий исходный порядок исторических событий внутри одинакового timestamp не восстанавливается.
- Внешний HTTP не получает гарантии exactly-once. Для платежей используются стабильные ключи; CRM unknown outcome требует операторской сверки перед повтором.
- Recovery требует актуального активного admin и причины; действия аудируются, работающий обработчик защищён от ручного вмешательства.

## Источники

- [Исходный аудит в репозитории](https://github.com/ShafranovKirill/delivest/blob/c673277b66001223243eb6569aee7076efee033d/docs/tasks/REFACTOR_COMPLETION.md).
- [Реестр требований](https://github.com/ShafranovKirill/delivest/blob/c673277b66001223243eb6569aee7076efee033d/docs/tasks/COVERAGE.md).
- [Нагрузочный протокол](https://github.com/ShafranovKirill/delivest/blob/c673277b66001223243eb6569aee7076efee033d/docs/runbooks/load-results-2026-11-07-completion.md).
- [Компактный evidence JSON с SHA-256 исходных отчётов](https://github.com/ShafranovKirill/delivest/blob/c673277b66001223243eb6569aee7076efee033d/docs/runbooks/evidence/refactor-completion-load-2026-11-07.json).
- [Восстановление Events](https://github.com/ShafranovKirill/delivest-ex/blob/2ae31664f38b22daacb500f595d606db195fd648/docs/event-delivery-recovery.md).
- [Восстановление CRM-команд](https://github.com/ShafranovKirill/delivest-ex/blob/2ae31664f38b22daacb500f595d606db195fd648/docs/crm-command-recovery.md).
- [Release/restore runbook](https://github.com/ShafranovKirill/delivest/blob/c673277b66001223243eb6569aee7076efee033d/docs/runbooks/release-restore.md).

Пути <code>/tmp/...</code> относятся к локальным журналам исходной сессии; сами журналы в Notion не загружаются. Долговременные подтверждения — ссылки CI, PR и tracked evidence JSON.

Эта запись дополняет исходный аудит финальным зелёным CI и состоявшимися merge. Отсутствие sandbox-доступов подтверждено пользователем; внешние проверки не отмечены выполненными.

