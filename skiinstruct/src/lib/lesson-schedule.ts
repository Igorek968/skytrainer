import type { Order } from "@prisma/client";

/** Плановое начало занятия (для правил отмены и опоздания). */
export function getLessonStartAt(
  order: Pick<Order, "requestedStartDate" | "acceptedAt">,
): Date | null {
  if (order.requestedStartDate) return order.requestedStartDate;
  return null;
}

export function hoursUntilLesson(lessonStart: Date, now = new Date()): number {
  return (lessonStart.getTime() - now.getTime()) / (3600 * 1000);
}
