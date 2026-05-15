/**
 * Логика «мягкого» ответа инструктора: без 60 с и без ETA на мультидневных бронях
 * и при явной «записи на дату» (flexibleInstructorInvite).
 */

export function orderSpansMultipleLessonDays(order: { requestedDays: number | null }): boolean {
  return (order.requestedDays ?? 1) > 1;
}

export function orderRelaxedInstructorTiming(order: {
  flexibleInstructorInvite: boolean;
  requestedDays: number | null;
}): boolean {
  return order.flexibleInstructorInvite === true || orderSpansMultipleLessonDays(order);
}
