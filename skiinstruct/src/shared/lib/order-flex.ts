/** Минут на принятие срочной заявки инструктором. */
export const URGENT_INSTRUCTOR_DEADLINE_MIN = 15;

/** После дедлайна ответа — ещё столько можно принять заявку явным действием (push / кнопка). */
export const INSTRUCTOR_ACCEPT_AFTER_DEADLINE_GRACE_MS = 60 * 60 * 1000;

export function instructorCanAcceptAfterDeadline(
  pendingExpiresAt: Date | string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (pendingExpiresAt == null) return true;
  const exp = new Date(pendingExpiresAt).getTime();
  if (!Number.isFinite(exp)) return true;
  if (exp >= nowMs) return true;
  return nowMs - exp <= INSTRUCTOR_ACCEPT_AFTER_DEADLINE_GRACE_MS;
}

/**
 * «Мягкий» ответ инструктора: без дедлайна и без срочного ETA.
 * Запись на дату, будущие даты, несколько дней, урок сегодня (не срочно).
 */

export function lessonCalendarYmd(date: Date | string | null | undefined): string | null {
  if (date == null) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function todayCalendarYmd(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Урок запланирован на календарный день «сегодня» (день в день). */
export function orderIsTodayLessonDay(order: {
  requestedStartDate?: Date | string | null;
}): boolean {
  const lesson = lessonCalendarYmd(order.requestedStartDate);
  if (!lesson) return false;
  return lesson === todayCalendarYmd();
}

/** Урок запланирован на календарный день позже «сегодня». */
export function orderIsFutureLessonDay(order: {
  requestedStartDate?: Date | string | null;
}): boolean {
  const lesson = lessonCalendarYmd(order.requestedStartDate);
  if (!lesson) return false;
  return lesson > todayCalendarYmd();
}

export function orderSpansMultipleLessonDays(order: { requestedDays: number | null }): boolean {
  return (order.requestedDays ?? 1) > 1;
}

export type OrderTimingInput = {
  urgentInvite?: boolean;
  flexibleInstructorInvite: boolean;
  requestedDays: number | null;
  requestedStartDate?: Date | string | null;
};

/** Срочный вызов: инструктор на линии, ограниченное время на принятие. */
export function orderIsUrgent(order: OrderTimingInput): boolean {
  return order.urgentInvite === true;
}

export function orderRelaxedInstructorTiming(order: OrderTimingInput): boolean {
  if (orderIsUrgent(order)) return false;
  return (
    order.flexibleInstructorInvite === true ||
    orderSpansMultipleLessonDays(order) ||
    orderIsTodayLessonDay(order) ||
    orderIsFutureLessonDay(order)
  );
}

/** Без ETA при принятии: только запись на дату или бронь на несколько дней. */
export function orderSkipsInstructorEta(order: {
  flexibleInstructorInvite: boolean;
  requestedDays: number | null;
}): boolean {
  void order;
  return true;
}

/** Подпись для UI (модалка, карточка заказа). */
export function orderRelaxedTimingHint(order: OrderTimingInput): string {
  if (orderIsUrgent(order)) {
    return `Срочно — ${URGENT_INSTRUCTOR_DEADLINE_MIN} мин на принятие`;
  }
  if (order.flexibleInstructorInvite) {
    return "Запись на дату — без таймера ответа";
  }
  if (orderSpansMultipleLessonDays(order)) {
    return "Несколько дней — время прибытия согласуйте в чате";
  }
  if (orderIsTodayLessonDay(order)) {
    return "Урок сегодня — ответьте, когда будете готовы";
  }
  if (orderIsFutureLessonDay(order)) {
    return "Урок не сегодня — запись подтверждается автоматически после оплаты";
  }
  return "";
}

/** Дедлайн принятия — только для режима «Срочно». */
export function computePendingExpiresAt(order: OrderTimingInput & { now?: Date }): Date | null {
  if (!orderIsUrgent(order)) return null;
  const base = order.now ?? new Date();
  return new Date(base.getTime() + URGENT_INSTRUCTOR_DEADLINE_MIN * 60 * 1000);
}

export function formatUrgentCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function urgentDeadlineLabel(): string {
  return `${URGENT_INSTRUCTOR_DEADLINE_MIN} мин`;
}
