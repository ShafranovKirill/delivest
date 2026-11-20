# CI и правила веток: этап 4

## Проверки и порядок интеграции

- `Checks` запускается для push в `develop`, PR в `develop` и `main`, а также через `workflow_dispatch` и `workflow_call`. Отдельный push в `main` больше не запускает те же проверки повторно. `Release` по-прежнему вызывает `Checks` и `E2E` на SHA своего запуска.
- `E2E` (`Playwright`) продолжает запускаться по своим существующим событиям. Для PR в `main` workflow `Main source` требует, чтобы исходная ветка называлась `develop` и находилась в этом же репозитории. Проверка не получает исходный код PR.
- Активированы rulesets [develop](https://github.com/ShafranovKirill/delivest/rules/27744491) и [main](https://github.com/ShafranovKirill/delivest/rules/27744550), сохранённые в `.github/rulesets/develop.json` и `.github/rulesets/main.json`. Оба требуют PR, запрещают удаление и force push, требуют статусы GitHub Actions (`integration_id: 15368`) `server`, `agent`, `client`, `static`, `Playwright`; `main` дополнительно требует `main-source`. Нулевое число обязательных approvals не вводит новое требование к ревьюерам. Перед слиянием ветка PR должна быть актуальна относительно целевой (`strict_required_status_checks_policy`). Readback effective rules для обеих веток подтвердил параметры и контексты. Новый `main-source` станет доступен GitHub после доставки workflow; до этого PR в `main` будет ждать этот обязательный статус.
- До изменений 2026-11-20 аудит GitHub API не обнаружил branch protection или rulesets для `main` и `develop`. После активации действуют указанные rulesets. Реальный тест блокировки PR пока не проводился.
- `develop` принимает изменения через PR с обязательными проверками. `main` принимает релиз только через PR из `develop`. До команды пользователя «Пуш в Девелоп» не создавать тестовый PR, не запускать полный `make preflight` или полный E2E, не выполнять push или merge. Перед отправкой нужны адресные проверки, полный локальный `make preflight` и полный E2E на итоговом коде согласно `AGENTS.md`.

## Исходная метрика

Шесть доступных сопоставимых пар успешных первых запусков `Checks`/`E2E` для PR, 15–20 ноября 2026 года. Время PR вычислено от минимального `created_at` до максимального `updated_at` в паре; сумма времени jobs — сумма длительностей jobs в обоих запусках. Повторные попытки исключены. Источник: GitHub Actions API, локальные снимки `/tmp/delivest-stage4-baseline.json`, `/tmp/delivest-stage4-runs.json`, `/tmp/delivest-stage4-e2e-runs.json`.

| Checks run | E2E run | Время PR, мин | Сумма jobs, мин |
| --- | --- | ---: | ---: |
| [#44740849475](https://github.com/ShafranovKirill/delivest/actions/runs/44740849475) | [#44740849599](https://github.com/ShafranovKirill/delivest/actions/runs/44740849599) | 12.767 | 24.933 |
| [#43828714116](https://github.com/ShafranovKirill/delivest/actions/runs/43828714116) | [#43828714071](https://github.com/ShafranovKirill/delivest/actions/runs/43828714071) | 11.050 | 19.100 |
| [#43761305304](https://github.com/ShafranovKirill/delivest/actions/runs/43761305304) | [#43761305385](https://github.com/ShafranovKirill/delivest/actions/runs/43761305385) | 12.117 | 19.367 |
| [#43759951549](https://github.com/ShafranovKirill/delivest/actions/runs/43759951549) | [#43759951474](https://github.com/ShafranovKirill/delivest/actions/runs/43759951474) | 13.750 | 21.400 |
| [#43756528882](https://github.com/ShafranovKirill/delivest/actions/runs/43756528882) | [#43756528894](https://github.com/ShafranovKirill/delivest/actions/runs/43756528894) | 10.300 | 17.933 |
| [#43755301741](https://github.com/ShafranovKirill/delivest/actions/runs/43755301741) | [#43755301739](https://github.com/ShafranovKirill/delivest/actions/runs/43755301739) | 11.617 | 19.550 |

Медиана времени PR — **11.867 мин**, медиана суммы времени jobs — **19.4585 мин**, общая сумма по шести парам — **122.283 мин**. Среди последних 20 workflow runs `Checks` один имел `run_attempt > 1`, среди последних 20 workflow runs `E2E` таких не было; в выбранных шести первых попытках повторов нет. Недоступные из-за timeout данные недавних jobs не включены. Метрики после интеграции пока нет; её следует собрать тем же методом. Удаление повторного запуска `Checks` на push в `main` не меняет состав проверок PR, поэтому ускорение PR не предполагается.

Этапы 1–3 находятся отдельно в ветке `codex/release-upgrade-recovery`; эта ветка не включает их cherry-pick.
