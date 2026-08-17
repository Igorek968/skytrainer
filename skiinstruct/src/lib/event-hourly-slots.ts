/** Генерация почасовых слотов для режима «занятия по часам». */

export type HourlySlotDraft = {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  title: string;
  durationMinutes: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseHourMinute(raw: string): { h: number; m: number } | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return null;
  }
  return { h, m: min };
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/**
 * Слоты с `timeFrom` до `timeTo` (конец не включается), шаг = durationMinutes.
 * Пример: 09:00–21:00, 60 мин → 09:00 … 20:00.
 */
export function generateHourlySlots(input: {
  dateFrom: string;
  dateTo?: string | null;
  timeFrom: string;
  timeTo: string;
  durationMinutes?: number;
}): HourlySlotDraft[] {
  const duration = input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : 60;
  const start = parseHourMinute(input.timeFrom);
  const end = parseHourMinute(input.timeTo);
  if (!start || !end) return [];
  const startMin = start.h * 60 + start.m;
  const endMin = end.h * 60 + end.m;
  if (endMin <= startMin) return [];

  const dateFrom = input.dateFrom.trim();
  const dateTo = (input.dateTo?.trim() || dateFrom).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    return [];
  }
  if (dateTo < dateFrom) return [];

  const out: HourlySlotDraft[] = [];
  let cursor = dateFrom;
  let dayGuard = 0;
  while (cursor <= dateTo && dayGuard < 370) {
    for (let t = startMin; t + duration <= endMin; t += duration) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      out.push({
        date: cursor,
        time: `${pad2(h)}:${pad2(m)}`,
        title: "",
        durationMinutes: duration,
      });
    }
    cursor = addDaysYmd(cursor, 1);
    dayGuard += 1;
  }
  return out;
}
