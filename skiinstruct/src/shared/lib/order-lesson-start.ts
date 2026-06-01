import { parseOrderTimestampMs } from "@/shared/lib/order-instructor-eta";

/** За сколько минут до начала показывать инструктору всплывающее напоминание. */
export const LESSON_START_POPUP_LEAD_MINUTES = 5;

export function resolveLessonStartMs(
  requestedStartDate?: string | Date | null,
): number | null {
  return parseOrderTimestampMs(requestedStartDate);
}

export function msUntilLessonStart(requestedStartDate?: string | Date | null, nowMs = Date.now()): number | null {
  const startMs = resolveLessonStartMs(requestedStartDate);
  if (startMs == null) return null;
  return startMs - nowMs;
}

/** Окно для однократного всплывающего окна инструктора (~5 мин до старта). */
export function isInLessonStartPopupWindow(
  requestedStartDate?: string | Date | null,
  nowMs = Date.now(),
): boolean {
  const left = msUntilLessonStart(requestedStartDate, nowMs);
  if (left == null || left <= 0) return false;
  const leadMs = LESSON_START_POPUP_LEAD_MINUTES * 60_000;
  return left <= leadMs;
}
