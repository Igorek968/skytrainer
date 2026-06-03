import { durationHours } from "@/lib/pricing";
import type { LessonDuration } from "@prisma/client";
import { orderLessonSpanMinutes } from "@/shared/lib/order-lesson-times";

/**
 * Часы к оплате: приоритет — фактическое окно requestedStartDate..requestedEndDate
 * или время из notes; enum duration — только запасной вариант.
 */
export function resolveBillableHours(params: {
  duration: LessonDuration;
  requestedStartDate?: Date | string | null;
  requestedEndDate?: Date | string | null;
  notes?: string | null;
}): number {
  const startRaw = params.requestedStartDate;
  const endRaw = params.requestedEndDate;
  if (startRaw && endRaw) {
    const start = new Date(startRaw).getTime();
    const end = new Date(endRaw).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      const hours = (end - start) / 3_600_000;
      const roundedHalfHour = Math.round(hours * 2) / 2;
      return Math.max(0.5, roundedHalfHour);
    }
  }
  const spanMin = orderLessonSpanMinutes({
    requestedStartDate: startRaw,
    requestedEndDate: endRaw,
    notes: params.notes,
  });
  if (spanMin != null && spanMin > 0) {
    const hours = spanMin / 60;
    const roundedHalfHour = Math.round(hours * 2) / 2;
    return Math.max(0.5, roundedHalfHour);
  }
  return durationHours(params.duration);
}
