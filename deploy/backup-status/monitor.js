(() => {
  "use strict";

  const token = location.hash.slice(1).toLowerCase();
  const steps = {
    accepted: "Задание принято",
    quiescing: "Останавливаем запись в приложении",
    validating_archive: "Проверяем архив",
    checking_compatibility: "Проверяем совместимость",
    preparing_storage: "Готовим хранилище",
    staging_database: "Готовим базу данных",
    replacing_storage: "Заменяем хранилище",
    replacing_database: "Заменяем базу данных",
    exporting: "Создаём архив",
    restarting: "Запускаем приложение",
    checking_readiness: "Проверяем готовность приложения",
    ready: "Приложение готово"
  };
  const phases = {
    queued: "В очереди", waiting: "Ожидание", running: "Выполняется",
    complete: "Завершено", failed: "Ошибка", interrupted: "Прервано"
  };
  const reasons = {
    archive_integrity: "Проверка целостности архива не прошла: проверьте SHA-256, состав архива и загрузите исправный файл.",
    migration_mismatch: "Версии схемы базы несовместимы. Проверьте миграции целевого приложения перед повторной попыткой.",
    readiness_failed: "Приложение не прошло проверку готовности после запуска. Проверьте состояние контейнеров и журнал сервера.",
    unsafe_restore: "Состояние восстановления небезопасно. Не запускайте приложение вручную до проверки оператором.",
    generic_failure: "Задание остановилось с ошибкой. Проверьте журнал задания в админке."
  };
  const $ = (id) => document.getElementById(id);
  const tokenValid = /^[0-9a-f]{64}$/.test(token);
  let last = null;
  let lastHeartbeat = null;
  const startedAt = Date.now();

  function date(value) {
    if (typeof value !== "string") return null;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  function time(value) {
    const parsed = date(value);
    return parsed ? new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      second: "2-digit", timeZoneName: "short"
    }).format(parsed) : "Время не указано";
  }

  function duration(start, end) {
    const a = date(start), b = date(end);
    if (!a || !b || b < a) return "";
    const seconds = Math.floor((b - a) / 1000);
    if (seconds < 60) return `${seconds} с`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} мин ${seconds % 60} с`;
    return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
  }

  function signal(id, label, tone) {
    const el = $(id);
    el.textContent = label;
    el.className = `signal${tone ? ` ${tone}` : ""}`;
  }

  function renderSteps(status) {
    const list = $("steps");
    list.replaceChildren();
    const events = Array.isArray(status.steps) ? status.steps.filter((item) =>
      item && Object.hasOwn(steps, item.step) && date(item.updated_at)
    ).slice(0, 30) : [];
    if (!events.length && Object.hasOwn(steps, status.step)) {
      events.push({step: status.step, updated_at: status.updated_at});
    }
    for (let i = 0; i < events.length; i += 1) {
      const item = events[i];
      const next = events[i + 1];
      const current = i === events.length - 1 && status.phase === "running";
      const failed = ["failed", "interrupted"].includes(status.phase) && item.step === (status.failed_step || status.step);
      const row = document.createElement("li");
      row.className = failed ? "failed" : current ? "current" : "";
      const dot = document.createElement("span");
      dot.className = "step-dot";
      dot.setAttribute("aria-hidden", "true");
      const body = document.createElement("div");
      const name = document.createElement("span");
      name.className = "step-name";
      name.textContent = steps[item.step];
      const at = document.createElement("span");
      at.className = "step-time";
      at.textContent = time(item.updated_at);
      body.append(name, at);
      const spent = document.createElement("span");
      spent.className = "step-duration";
      const end = next?.updated_at || (current ? new Date().toISOString() : status.updated_at);
      spent.textContent = duration(item.updated_at, end);
      row.append(dot, body, spent);
      list.append(row);
    }
  }

  function advice(status) {
    const failed = status.phase === "failed" || status.phase === "interrupted";
    if (failed) {
      const reason = Object.hasOwn(reasons, status.reason_code) ? reasons[status.reason_code] : reasons.generic_failure;
      const step = steps[status.failed_step] || steps[status.step] || "текущий шаг";
      if (!status.safe_to_resume) return `${reason} Ошибка на шаге «${step}». Не запускайте приложение вручную и передайте задание оператору.`;
      const beforeSwap = status.action === "import" && ["validating_archive", "checking_compatibility", "preparing_storage", "staging_database"].includes(status.failed_step || status.step);
      const dataNote = beforeSwap ? "Рабочие данные не заменялись." : status.action === "import" && status.step === "checking_readiness" ? "Замена могла завершиться; проверьте целевой сайт перед повтором." : "";
      return `${reason} Ошибка на шаге «${step}». ${dataNote} Целевой сайт можно проверить; перед повтором убедитесь в состоянии исходных данных и архива.`;
    }
    if (status.phase === "complete") {
      return status.action === "export"
        ? "Архив создан. Вернитесь в админку, чтобы скачать и сохранить его в защищённом месте."
        : "Восстановление завершено, приложение прошло проверку готовности. Откройте админку и проверьте данные и работу сайта.";
    }
    if (status.action === "import" && ["replacing_storage", "replacing_database", "restarting", "checking_readiness"].includes(status.step)) {
      return "Идёт замена и запуск. Не запускайте контейнеры вручную; дождитесь проверки готовности.";
    }
    return "Оставьте страницу открытой. Шаги и состояние агента обновятся автоматически.";
  }

  function render(status) {
    last = status;
    $("action").textContent = status.action === "import" ? "ВОССТАНОВЛЕНИЕ ИЗ АРХИВА" : "СОЗДАНИЕ ПОЛНОГО АРХИВА";
    const phase = Object.hasOwn(phases, status.phase) ? status.phase : "waiting";
    const label = phases[phase];
    $("phase").textContent = label;
    $("phase").className = `phase${["failed", "interrupted"].includes(phase) ? " bad" : ""}`;
    $("updated").textContent = `Обновлено: ${time(status.updated_at)}`;
    $("summary").textContent = phase === "complete"
      ? (status.action === "import" ? "Восстановление завершено, приложение готово." : "Полный архив создан.")
      : ["failed", "interrupted"].includes(phase)
        ? `${label} на шаге «${steps[status.failed_step] || steps[status.step] || "неизвестный шаг"}».`
        : `${label}: ${steps[status.step] || "ожидаем сведения о шаге"}.`;
    $("advice").textContent = advice(status);
    renderSteps(status);
  }

  async function getJSON(path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(path, {cache: "no-store", referrerPolicy: "no-referrer", credentials: "omit", signal: controller.signal});
      if (!response.ok) throw new Error("unavailable");
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function poll() {
    const [statusResult, heartbeatResult] = await Promise.allSettled([
      getJSON(`/_backup-status/${token}.json`),
      getJSON("/_backup-status/heartbeat.json")
    ]);
    const status = statusResult.status === "fulfilled" ? statusResult.value : null;
    if (status && Object.hasOwn(phases, status.phase) && Object.hasOwn(steps, status.step)) {
      render(status);
      signal("connection", "Связь есть", "");
    } else {
      signal("connection", last ? "Связь потеряна · показываем последнее состояние" : "Нет связи · ожидаем данные", "warn");
      if (!last && Date.now() - startedAt > 15_000) {
        $("summary").textContent = "Состояние задания пока недоступно. Возможно, ссылка неверна или агент ещё не опубликовал первый шаг.";
        $("advice").textContent = "Проверьте ссылку в админке. Эта страница продолжит попытки подключения автоматически.";
      }
    }
    if (heartbeatResult.status === "fulfilled") lastHeartbeat = date(heartbeatResult.value?.updated_at);
    const fresh = lastHeartbeat && Date.now() - lastHeartbeat.getTime() < 10_000;
    signal("agent", fresh ? "Агент работает" : "Агент не отвечает", fresh ? "" : "warn");
    if (last?.phase === "running") renderSteps(last);
    setTimeout(poll, 2_000);
  }

  if (!tokenValid) {
    $("summary").textContent = "Ссылка на задание неполная. Откройте страницу состояния из админки.";
    signal("connection", "Нет идентификатора задания", "bad");
    signal("agent", "Нет данных", "warn");
    $("advice").textContent = "Вернитесь в админку и откройте ссылку на это задание заново.";
    return;
  }
  poll();
})();
