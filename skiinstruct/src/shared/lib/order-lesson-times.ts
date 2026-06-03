/**
 * Время первого/последнего дня брони кодируется в `notes` (см. POST /api/orders),
 * чтобы не зависеть от отдельных колонок Prisma и старых сгенерированных клиентов.
 */
export const LESSON_TIMES_IN_NOTES =
  /Время:\s*с\s*(\d{2}:\d{2})\s*\(день начала\)\s*до\s*(\d{2}:\d{2})\s*\(день окончания\)/;

export function hasLessonTimeWindowInNotes(notes: string | null | undefined): boolean {
  return LESSON_TIMES_IN_NOTES.test(notes ?? "");
}

function clockHmToMinutes(hm: string): number {
  const m = hm.trim().match(/^(\d{2}):(\d{2})/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Длина окна занятия в минутах (по датам заказа или строке в notes). */
export function orderLessonSpanMinutes(order: {
  requestedStartDate?: Date | string | null;
  requestedEndDate?: Date | string | null;
  notes?: string | null;
}): number | null {
  if (order.requestedStartDate && order.requestedEndDate) {
    const startMs = new Date(order.requestedStartDate).getTime();
    const endMs = new Date(order.requestedEndDate).getTime();
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      return Math.round((endMs - startMs) / 60_000);
    }
  }
  const m = (order.notes ?? "").match(LESSON_TIMES_IN_NOTES);
  if (!m) return null;
  const span = clockHmToMinutes(m[2]) - clockHmToMinutes(m[1]);
  return span > 0 ? span : null;
}

function formatLessonClockHm(date: Date | string): string {
  return new Date(date).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function lessonCalendarYmdFromDate(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

export function hasOrderLessonActualTime(order: {
  requestedStartDate?: Date | string | null;
  notes?: string | null;
}): boolean {
  return order.requestedStartDate != null || hasLessonTimeWindowInNotes(order.notes);
}

/** Фактическое время из полей заказа; для старых заявок — из `notes`. */
export function orderLessonActualTimeLine(order: {
  requestedStartDate?: Date | string | null;
  requestedEndDate?: Date | string | null;
  notes?: string | null;
}): string | null {
  const m = (order.notes ?? "").match(LESSON_TIMES_IN_NOTES);
  if (m) {
    return `Время заявки: ${m[1]} — ${m[2]}`;
  }
  if (order.requestedStartDate) {
    const startHm = formatLessonClockHm(order.requestedStartDate);
    if (order.requestedEndDate) {
      const endHm = formatLessonClockHm(order.requestedEndDate);
      const multiDay =
        lessonCalendarYmdFromDate(order.requestedStartDate) !==
        lessonCalendarYmdFromDate(order.requestedEndDate);
      if (multiDay) {
        return `Время заявки: с ${startHm} (день начала) до ${endHm} (день окончания)`;
      }
      if (startHm !== endHm) {
        return `Время заявки: ${startHm} — ${endHm}`;
      }
    }
    return `Время заявки: ${startHm}`;
  }
  return null;
}

/** @deprecated Используйте {@link orderLessonActualTimeLine}; оставлено для совместимости уведомлений. */
export function lessonTimeWindowLineFromNotes(notes: string | null | undefined): string | null {
  return orderLessonActualTimeLine({ notes });
}
