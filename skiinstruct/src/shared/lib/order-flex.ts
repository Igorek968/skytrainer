/**
 * «Мягкий» ответ инструктора: без 60 с и без срочного ETA.
 * Единая логика для день-в-день, будущих дат и записи на дату.
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

export function orderRelaxedInstructorTiming(order: {
  flexibleInstructorInvite: boolean;
  requestedDays: number | null;
  requestedStartDate?: Date | string | null;
}): boolean {
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
export function orderRelaxedTimingHint(order: {
  flexibleInstructorInvite: boolean;
  requestedDays: number | null;
  requestedStartDate?: Date | string | null;
}): string {
  if (order.flexibleInstructorInvite) {
    return "Запись на дату — без таймера ответа";
  }
  if (orderSpansMultipleLessonDays(order)) {
    return "Несколько дней — без таймера 60 с; время прибытия согласуйте в чате";
  }
  if (orderIsTodayLessonDay(order)) {
    return "Урок сегодня — ответьте, когда будете готовы (без 60 с)";
  }
  if (orderIsFutureLessonDay(order)) {
    return "Урок не сегодня — запись подтверждается автоматически после оплаты";
  }
  return "";
}
