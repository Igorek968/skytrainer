/** Сообщения для toast/UI: без сырого английского «Failed to fetch» и служебных кодов. */

const NETWORK_RE =
  /^(failed to fetch|networkerror when attempting to fetch resource|network request failed|load failed|network error)$/i;

const ABORT_RE = /^(aborted|the user aborted a request|aborterror)$/i;

const ENGLISH_API: Record<string, string> = {
  unauthorized: "Войдите в аккаунт снова",
  forbidden: "Недостаточно прав для этого действия",
  "not found": "Не найдено",
  "invalid json": "Некорректные данные запроса",
  "internal server error": "Ошибка сервера. Попробуйте позже",
};

function firstZodMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const m = firstZodMessage(item);
      if (m) return m;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      const m = firstZodMessage(v);
      if (m) return m;
    }
  }
  return null;
}

/** Достаёт текст ошибки из JSON `{ error: ... }` (строка или flatten Zod). */
export function parseApiErrorPayload(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return userFacingErrorMessage(fallback, fallback);
  }
  const err = (payload as { error?: unknown; message?: unknown }).error;
  if (typeof err === "string" && err.trim()) {
    return userFacingErrorMessage(err, fallback);
  }
  if (err && typeof err === "object") {
    const fromZod = firstZodMessage(err);
    if (fromZod) return userFacingErrorMessage(fromZod, fallback);
  }
  const message = (payload as { message?: unknown }).message;
  if (typeof message === "string" && message.trim()) {
    return userFacingErrorMessage(message, fallback);
  }
  return userFacingErrorMessage(fallback, fallback);
}

export function userFacingErrorMessage(
  error: unknown,
  fallback = "Не удалось выполнить действие",
): string {
  if (error == null) return fallback;

  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" &&
            error !== null &&
            "message" in error &&
            typeof (error as { message: unknown }).message === "string"
          ? (error as { message: string }).message
          : String(error);

  const msg = raw.replace(/\s+/g, " ").trim();
  if (!msg) return fallback;

  if (NETWORK_RE.test(msg) || /fetch failed/i.test(msg)) {
    return "Нет связи с сервером. Проверьте интернет и попробуйте снова";
  }
  if (ABORT_RE.test(msg)) {
    return "Запрос прерван. Попробуйте снова";
  }

  const mapped = ENGLISH_API[msg.toLowerCase()];
  if (mapped) return mapped;

  // Уже человекочитаемый русский текст
  if (/[а-яё]/i.test(msg)) return msg;

  // Служебные коды мутаций (save/submit/upload) — пусть caller задаёт fallback
  if (/^[a-z][a-z0-9_-]{0,40}$/i.test(msg) && msg.length <= 24) {
    return fallback;
  }

  if (msg.length > 200) return fallback;
  return msg;
}
