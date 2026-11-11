# P2 — товарные операции

Реализация: [server PR №42](https://github.com/ShafranovKirill/delivest-ex/pull/42), commit `02525688`. Раздел `/staff/b/:slug/products/operations` объединяет экспорт XLSX, импорт с предпросмотром и копирование всех или выбранных товаров в другой филиал. CSV endpoint и Bulk TSV сохранены.

Сопоставление использует постоянный `source_key`: UUID экспортированного товара либо заданный пользователем SKU-ключ новой строки. Имя и slug не используются для автоматического слияния. Для каждого совпадения выбирается «пропустить/обновить»; повтор не создаёт копии. Удалённый товар, неоднозначность, устаревший предпросмотр и недоступная ссылка требуют исправления до применения.

Шаблон `delivest-products-v1`, лист `Products`: `schema_version`, `source_key`, `name`, `price_rub`, `old_price_rub`, `description`, `quantity`, `weight`, `measure_unit`, `is_active`, `calories`, `proteins`, `fats`, `carbohydrates`, `excise`, `vat`, `tags`, `suggested`, `stars_price`, `stars_reward`, `category_id`, `modifier_group_ids`, `media_id`. `tags` — JSON-массив строк, логические значения — true/false, денежные поля — рубли с точными копейками.

Категории копируются по стабильному ID с сохранённым сопоставлением. Группы модификаторов глобальны в существующей модели и переиспользуются с действующим правом чтения. Фото — разрешённые локальные публичные media objects; внешние URL/файлы другого инстанса не загружаются автоматически. CRM ID не копируются. Shared target можно пропустить, обновлять его запрещено; локальный импорт не изменяет CRM-owned каталог.

Запись, версия каталога и один bulk audit event атомарны; skip-only не создаёт аудит/версию. Повторная проверка fingerprints, row locks и branch advisory lock защищают apply. При конфликте конкурентный пользователь получает stale-preview и повторяет просмотр. Уведомления выполняются после commit; их ошибка не превращает успешную запись в ошибку операции.

Лимиты: 5 MiB ZIP, 20 MiB распакованного содержимого, 40 entries, 1000 товаров, 40 колонок, 32 KiB ячейка. Формулы, DTD/ENTITY, внешние relationships, недопустимые ZIP/XML, неизвестный шаблон и ссылки отклоняются. Необычные Excel extensions могут быть отклонены явно.

При общей интеграции Dialyzer обнаружил недостижимую else-ветку decoder; [server PR №46](https://github.com/ShafranovKirill/delivest-ex/pull/46) удалил только её, сохранив rescue/catch. Полный precommit после правки — 1542 теста без ошибок, 7 исключены. Независимый повтор главного агента: 18 XLSX-тестов и Dialyzer прошли.

Проверки: финальный `mix precommit` — 1510 тестов, 0 ошибок, 7 исключены; compile/format/strict Credo прошли. Assets build прошёл отдельно; server typecheck не настроен и не запускался. Независимый прогон главного агента — 42 domain/UI/controller/CSV теста без ошибок. XLSX открыт и пересохранён openpyxl 3.1.5, затем прочитан обратно с сохранением Unicode, numeric prices и bool. Playwright проверил copy, repeat, source preservation, настоящий download/upload и canonical target round trip; независимый повтор главного агента — 1/1. Первый полный прогон выявил гонку тестов с общим cart cache; модули операций переведены в serial mode, полный повтор прошёл.
