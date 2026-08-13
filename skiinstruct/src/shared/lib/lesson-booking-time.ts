import type { LessonDuration } from "@prisma/client";

import { durationHours } from "@/lib/pricing";
import { appNowHm, appTodayYmd } from "@/shared/lib/app-timezone";
import { billableHoursFromLessonWallWindow } from "@/shared/lib/lesson-wall-datetime";

/** Минимальный запас до начала занятия при заказе «на сегодня» (1 час). */
export const LESSON_BOOKING_MIN_LEAD_MINUTES = 60;

const MIN_SPAN_MINUTES = 30;

/** «Сегодня» по Москве (Europe/Moscow) — единый TZ платформы. */
export function localTodayYmd(now = new Date()): string {
  return appTodayYmd(now);
}

export function hmToMinutes(hm: string): number {
  const m = hm.trim().match(/^(\d{2}):(\d{2})/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function minutesToHm(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total));
  const h = Math.floor(clamped / 60);
  const min = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function formatYmdRu(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

/** В браузере: дата+время как на экране (локальный TZ). */
export function parseLessonWallDateTime(ymd: string, hm: string): Date | null {
  const y = ymd.trim();
  const t = hm.trim().match(/^(\d{2}):(\d{2})/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(y) || !t) return null;
  const d = new Date(`${y}T${t[1]}:${t[2]}:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Ближайшее допустимое время начала для заказа на сегодня (округление вверх до 5 мин, МСК). */
export function earliestBookableStartHm(now = new Date()): string {
  const minAt = new Date(now.getTime() + LESSON_BOOKING_MIN_LEAD_MINUTES * 60_000);
  const hm = appNowHm(minAt);
  const mins = hmToMinutes(hm);
  return minutesToHm(Math.ceil(mins / 5) * 5);
}

export function defaultLessonTimeWindow(
  now = new Date(),
  duration: LessonDuration = "TWO_HOURS",
): { start: string; end: string } {
  const start = earliestBookableStartHm(now);
  return {
    start,
    end: lessonEndHmFromStartAndDuration(start, duration),
  };
}

export function lessonSpanMinutesSameDay(startHm: string, endHm: string): number {
  return hmToMinutes(endHm) - hmToMinutes(startHm);
}

/** Время окончания в тот же день по началу и тарифу. */
export function lessonEndHmFromStartAndDuration(
  startHm: string,
  duration: LessonDuration,
): string {
  const endMins = hmToMinutes(startHm) + durationHours(duration) * 60;
  return minutesToHm(Math.min(23 * 60 + 59, endMins));
}

export type LessonBookingPreview = {
  scheduleLine: string;
  tariffLine: string;
  leadLine: string | null;
};

export function buildLessonBookingPreview(input: {
  lessonDate: string;
  lessonEndDate: string;
  lessonStartTime: string;
  lessonEndTime: string;
  lessonDays: number;
  duration: LessonDuration;
  now?: Date;
}): LessonBookingPreview {
  const startHm =
    input.lessonStartTime.trim().match(/^(\d{2}:\d{2})/)?.[1] ?? input.lessonStartTime.trim();
  const endHm = input.lessonEndTime.trim().match(/^(\d{2}:\d{2})/)?.[1] ?? input.lessonEndTime.trim();
  const dateRu = formatYmdRu(input.lessonDate);
  const sameDay = input.lessonDate === input.lessonEndDate;
  const spanMin = sameDay ? lessonSpanMinutesSameDay(startHm, endHm) : null;

  let scheduleLine: string;
  if (sameDay) {
    scheduleLine = `${dateRu}, ${startHm} — ${endHm}`;
    if (spanMin != null && spanMin > 0) {
      const hours = spanMin % 60 === 0 ? spanMin / 60 : Math.round((spanMin / 60) * 10) / 10;
      scheduleLine += ` (${hours} ч)`;
    }
  } else {
    const endDateRu = formatYmdRu(input.lessonEndDate);
    scheduleLine = `${dateRu} ${startHm} — ${endDateRu} ${endHm} (${input.lessonDays} дн.)`;
  }

  const billable =
    billableHoursFromLessonWallWindow({
      lessonDate: input.lessonDate,
      lessonEndDate: input.lessonEndDate,
      lessonStartTime: startHm,
      lessonEndTime: endHm,
    }) ?? durationHours(input.duration);
  const hoursLabel =
    billable % 1 === 0 ? `${billable} ч` : `${billable.toLocaleString("ru-RU")} ч`;
  const tariffLine = `К оплате по окну времени: ${hoursLabel}`;

  const now = input.now ?? new Date();
  const leadLine =
    input.lessonDate === localTodayYmd(now)
      ? `Сегодня ближайшее начало — с ${earliestBookableStartHm(now)} (не раньше чем через ${LESSON_BOOKING_MIN_LEAD_MINUTES} мин).`
      : null;

  return { scheduleLine, tariffLine, leadLine };
}
