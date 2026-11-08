# План работ Delivest

Текущий локальный результат и открытые gates: [S5 checkpoint](S5_CHECKPOINT.md).

Это рабочий вход в [ТЗ рефакторинга](sources/refactor-spec.md) и [ТЗ F01–F10](sources/features-spec.md), архивированные из Notion 6 ноября 2026 года. Полный текст требований и критериев приёмки находится в источниках; [COVERAGE.md](COVERAGE.md) связывает каждый стабильный ID с основной карточкой. Статус планирования не означает исправленный код, пройденные тесты или готовность к релизу.

## Как начать

1. Прочитать [SESSION_PLAN](SESSION_PLAN.md), затем [текущий checkpoint](SESSION_HANDOFF.md); открыть только нужные строки [COVERAGE](COVERAGE.md), карточку и раздел источника.
2. Взять несколько связанных задач доменного блока; разбить их на небольшие коммиты и проверяемые PR. На T00 сверить SHA/status и критичные риски; фактический путь UI → API → домен → хранилище → интеграции → тесты выяснять непосредственно перед соответствующим модулем. Старые результаты аудита не заменяют проверку текущего кода.
3. Перед изменением поведения зафиксировать отрицательный или аварийный сценарий, затем выполнить код, миграцию/откат, относящиеся проверки и ревью. После проверенного коммита или PR обновить checkpoint и статусы реестра с ссылкой на доказательство.

[Карточки этапов](phases/T00.md) обозначают порядок и зависимости. Независимые исправления T02/T03 и ранние O04/O05 допустимы параллельно с T01 по отдельным PR. F01 начинается после необходимых для него общих gates, а не после формального закрытия всех T01–T11. Одна сессия ведёт несколько связанных задач в одном доменном контексте; PR сам по себе не требует нового чата. T00/S1 завершены, S1 merged; [S1 checkpoint](S1_CHECKPOINT.md) сохраняет исторические результаты. S2 принят и merged в develop: [S2 checkpoint](S2_CHECKPOINT.md), [server PR №21](https://github.com/ShafranovKirill/delivest-ex/pull/21), [client PR №14](https://github.com/ShafranovKirill/delivest-web/pull/14). [Root PR №20](https://github.com/ShafranovKirill/delivest/pull/20) merged. Текущая работа — S3 и его оставшиеся сквозные gates; rollout отдельно.

## Доказательства и границы

[Аудит в commit 73f5458](https://github.com/ShafranovKirill/delivest/blob/73f5458/docs/audits/README.md) и [валидация](https://github.com/ShafranovKirill/delivest/blob/73f5458/docs/audits/2026-11-06-validation.md) доступны только в ветке аудита; [PR №16](https://github.com/ShafranovKirill/delivest/pull/16) был открыт при подготовке плана. Не копировать его файлы и gitlink клиента в эту ветку. Gitlinks `develop` на момент планирования: agent `9f75a632d4560504b06eb3c8e6d02f3dc72c2262`, client `cde8e9e87542172d7005b1d72c29e9a12fca8840`, server `4fce7b3572a04f4c938c300873432f51a0280c66`. Client `89b7e05` относится к [PR №13](https://github.com/ShafranovKirill/delivest-web/pull/13), не считать доставленным. Исторические числа тестов и локального benchmark приведены только в архиве источника.

Текущий результат S3 и оставшиеся gates находятся в [S3 checkpoint](S3_CHECKPOINT.md). S2 PR merged в develop.
