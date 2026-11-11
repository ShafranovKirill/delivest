# P5 — ночные операции

Реализация: [server PR №43](https://github.com/ShafranovKirill/delivest-ex/pull/43), commit `0835e4a5`. Миграция `20261210000023` добавляет `daily_runs`; номер 22 закреплён за P2.

Подтверждённые глобальные операции выполняются ежедневно в 03:00 по часовому поясу франшизы: `CartCleanupWorker`, `Loyalty.ExpireWorker`, `Logs.PruneWorker`, `ThumbnailBackfillWorker`. Заказы, платежи, статусы, polling, user-facing expiry notices и ручные операции сохраняют свои расписания. Отсутствующие в develop batch-модули сегментов/маркетинга не объявляются перенесёнными; registry позволяет подключить их позже с явной областью.

Диспетчер в отдельной лёгкой очереди раз в минуту вычисляет последнюю уже наступившую локальную дату. После простоя догоняется только один последний запуск, без архива пропущенных дней. Для DST fold выбирается первый instant, для gap — следующий valid instant. Branch API читает актуальный TZ из БД и поддерживает отдельный час (P4 — 06:00).

Marker и Oban job создаются одной транзакцией; уникальная запись local date и проверка активных jobs защищают от повторов/overlap. Completed replay не вызывает worker. Retry/snooze/terminal состояния сохраняются; dispatcher сверяет orphan/terminal/pruned jobs. Исторический marker не удаляется вместе с Oban pruner.

Операционный бюджет DailyJob — 90 минут, меньше существующего Lifeline rescue 2 часа. У legacy batch нет доказанного верхнего времени, поэтому большой запуск может перейти в retry/failed. Это ограничение выполнения, не измеренное обещание скорости.

Проверки: финальный `mix precommit` — 1487 тестов, 0 ошибок, 7 исключены; compile/format/strict Credo прошли. Главный агент независимо повторил 11 целевых тестов — без ошибок. Проверены TZ/DST, catchup, daily uniqueness, no-overlap marker, replay, retry/terminal reconciliation и сохранение оперативных cron. SQL Sandbox overlap-тест не измеряет гонку двух независимых DB connections.
