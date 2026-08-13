/** Платформенный часовой пояс ТвойТренер.рф (тренировки и админка). */
export const APP_TIME_ZONE = "Europe/Moscow";

/** Короткая подпись для UI. */
export const APP_TIME_ZONE_LABEL = "МСК";

type DateTimeFormatPartTypesSafe =
  | "year"
  | "month"
  | "day"
  | "hour"
  | "minute"
  | "second";

function zonedParts(date: Date, timeZone: string): Record<DateTimeFormatPartTypesSafe, string> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const out = {} as Record<DateTimeFormatPartTypesSafe, string>;
  for (const p of parts) {
    if (p.type === "literal") continue;
    if (
      p.type === "year" ||
      p.type === "month" ||
      p.type === "day" ||
      p.type === "hour" ||
      p.type === "minute" ||
      p.type === "second"
    ) {
      out[p.type] = p.value;
    }
  }
  return out;
}

/** Дата YYYY-MM-DD в платформенной таймзоне. */
export function appTodayYmd(now = new Date()): string {
  const p = zonedParts(now, APP_TIME_ZONE);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Часы:минуты в платформенной таймзоне. */
export function appNowHm(now = new Date()): string {
  const p = zonedParts(now, APP_TIME_ZONE);
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${hour}:${p.minute}`;
}

/**
 * Смещение как у Date#getTimezoneOffset: UTC − локаль (Europe/Moscow), в минутах.
 * Для Москвы обычно −180 (UTC+3). Используется в parseWallDateTime.
 */
export function appTimezoneOffsetMinutes(now = new Date()): number {
  const p = zonedParts(now, APP_TIME_ZONE);
  const hour = p.hour === "24" ? 0 : Number(p.hour);
  /** Мгновенный «стенной» момент Москвы, ошибочно взятый как UTC. */
  const wallAsIfUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    hour,
    Number(p.minute),
    Number(p.second),
  );
  // getTimezoneOffset = (UTC − local): now − wallAsIfUtc
  return Math.round((now.getTime() - wallAsIfUtc) / 60_000);
}

export function formatInAppTimeZone(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleString("ru-RU", { timeZone: APP_TIME_ZONE, ...options });
}
