const MS = 1_000;

/** Окно «за 1 час до начала»: старт через 55–61 мин (тик планировщика ~1 раз в минуту). */
export const START_REMINDER_MIN_MS = 55 * 60 * MS;
export const START_REMINDER_MAX_MS = 61 * 60 * MS;

export function startReminderWindow(now = Date.now()): { min: Date; max: Date } {
  return {
    min: new Date(now + START_REMINDER_MIN_MS),
    max: new Date(now + START_REMINDER_MAX_MS),
  };
}

export function isInStartReminderWindow(startAt: Date, now = Date.now()): boolean {
  const t = startAt.getTime();
  return t >= now + START_REMINDER_MIN_MS && t <= now + START_REMINDER_MAX_MS;
}
