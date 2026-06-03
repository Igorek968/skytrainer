/** Дата+время «как на экране клиента» → UTC Date (tzOffset = Date#getTimezoneOffset). */
export function parseWallDateTime(ymd: string, hm: string, tzOffsetMinutes = 0): Date | null {
  const y = ymd.trim();
  const t = hm.trim().match(/^(\d{2}):(\d{2})/)?.[0] ?? hm.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(y) || !/^\d{2}:\d{2}$/.test(t)) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(y);
  const hhmm = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m || !hhmm) return null;
  const utcMs =
    Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(hhmm[1]),
      Number(hhmm[2]),
      0,
      0,
    ) +
    tzOffsetMinutes * 60_000;
  const d = new Date(utcMs);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Часы к оплате / занятости по полям начала и окончания (не по enum duration). */
export function billableHoursFromLessonWallWindow(params: {
  lessonDate: string;
  lessonEndDate?: string;
  lessonStartTime: string;
  lessonEndTime: string;
  tzOffsetMinutes?: number;
}): number | null {
  const endYmd = params.lessonEndDate ?? params.lessonDate;
  const tz = params.tzOffsetMinutes ?? 0;
  const startDt = parseWallDateTime(params.lessonDate, params.lessonStartTime, tz);
  const endDt = parseWallDateTime(endYmd, params.lessonEndTime, tz);
  if (!startDt || !endDt) return null;
  const diffMs = endDt.getTime() - startDt.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
  const hours = diffMs / 3_600_000;
  const roundedHalfHour = Math.round(hours * 2) / 2;
  return Math.max(0.5, roundedHalfHour);
}
