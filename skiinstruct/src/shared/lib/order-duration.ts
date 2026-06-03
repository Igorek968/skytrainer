import type { LessonDuration } from "@prisma/client";

import { durationHours } from "@/lib/pricing";
import { orderLessonSpanMinutes } from "@/shared/lib/order-lesson-times";

const DURATION_LABEL_RU: Record<LessonDuration, string> = {
  ONE_HOUR: "1 час",
  TWO_HOURS: "2 часа",
  HALF_DAY: "полдня",
  FULL_DAY: "весь день",
};

/** Подпись длительности аренды инструктора (как при бронировании). */
export function lessonDurationLabelRu(duration: LessonDuration): string {
  return DURATION_LABEL_RU[duration];
}

/** Ближайший тарифный enum по фактическим часам окна занятия. */
export function inferLessonDurationFromBillableHours(hours: number): LessonDuration | null {
  if (!Number.isFinite(hours) || hours <= 0) return null;
  if (hours >= durationHours("FULL_DAY") - 0.25) return "FULL_DAY";
  if (hours >= durationHours("HALF_DAY") - 0.25) return "HALF_DAY";
  if (hours >= durationHours("TWO_HOURS") - 0.25) return "TWO_HOURS";
  if (hours >= durationHours("ONE_HOUR") - 0.25) return "ONE_HOUR";
  return null;
}

export type OrderDurationInput = {
  duration: LessonDuration;
  requestedStartDate?: Date | string | null;
  requestedEndDate?: Date | string | null;
  notes?: string | null;
  amountTotal?: string | number | null;
  agreedHourlyRate?: string | number | null;
};

/**
 * Длительность для отображения: согласована с суммой (ставка × часы) и окном времени,
 * если в БД поле duration расходится с оплатой (например 6000 ₽ при 3000 ₽/ч = 2 ч).
 */
export function resolveOrderDisplayDuration(order: OrderDurationInput): LessonDuration {
  const rate = order.agreedHourlyRate != null ? Number(order.agreedHourlyRate) : NaN;
  const total = order.amountTotal != null ? Number(order.amountTotal) : NaN;
  if (Number.isFinite(rate) && rate > 0 && Number.isFinite(total) && total > 0) {
    const fromPayment = inferLessonDurationFromBillableHours(total / rate);
    if (fromPayment) return fromPayment;
  }

  if (order.duration in DURATION_LABEL_RU) {
    return order.duration;
  }

  const spanMin = orderLessonSpanMinutes(order);
  if (spanMin != null) {
    const fromSpan = inferLessonDurationFromBillableHours(spanMin / 60);
    if (fromSpan) return fromSpan;
  }

  return order.duration;
}

/** Сумма заказа и длительность занятия для блока «Детали». */
export function formatOrderSumWithDuration(
  amountTotal: string | number | null | undefined,
  duration: LessonDuration | string | null | undefined,
): string {
  const amount =
    amountTotal != null && amountTotal !== "" ? `${Number(amountTotal)} ₽` : "—";
  if (!duration || !(duration in DURATION_LABEL_RU)) return amount;
  return `${amount} · ${lessonDurationLabelRu(duration as LessonDuration)}`;
}
