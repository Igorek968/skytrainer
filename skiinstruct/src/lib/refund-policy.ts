import type {
  LessonDuration,
  OrderCancelledBy,
  OrderStatus,
  PaymentStatus,
  RefundStatus,
} from "@prisma/client";

import {
  CANCEL_CLIENT_FULL_REFUND_HOURS,
  CANCEL_CLIENT_PARTIAL_PERCENT,
  CANCEL_CLIENT_PARTIAL_REFUND_HOURS,
  INSTRUCTOR_LATE_GRACE_MINUTES,
  QUALITY_CLAIM_MIN_DESCRIPTION_CHARS,
  QUALITY_CLAIM_WINDOW_HOURS,
  QUALITY_INCOMPETENCE_REFUND_PERCENT,
  QUALITY_NO_LESSON_MAX_MINUTES,
  QUALITY_SHORT_LESSON_REFUND_MAX_PERCENT,
  QUALITY_SHORT_LESSON_REFUND_MIN_PERCENT,
  QUALITY_SHORT_LESSON_THRESHOLD_PERCENT,
} from "@/lib/legal-config";
import { getLessonStartAt, hoursUntilLesson } from "@/lib/lesson-schedule";
import { durationHours } from "@/lib/pricing";
import { parseOrderTimestampMs } from "@/shared/lib/order-instructor-eta";

/** Дата из Prisma или ISO-строка из JSON API. */
type DateInput = Date | string | null | undefined;

function toDateMs(raw: DateInput): number | null {
  return parseOrderTimestampMs(raw);
}

export type RefundQuote = {
  percent: number;
  reason: string;
};

/** Доля возврата клиенту при отмене (0–100). */
export function computeCancelRefundQuote(params: {
  cancelledBy: OrderCancelledBy;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  requestedStartDate: Date | null;
  acceptedAt: Date | null;
  now?: Date;
}): RefundQuote {
  const now = params.now ?? new Date();

  if (params.paymentStatus !== "PAID") {
    return { percent: 0, reason: "Оплата не проводилась" };
  }

  if (
    params.status === "AWAITING_PAYMENT" ||
    params.status === "PENDING_INSTRUCTOR" ||
    params.status === "DRAFT" ||
    params.status === "EXPIRED"
  ) {
    return {
      percent: 100,
      reason:
        params.status === "EXPIRED"
          ? "Инструктор не принял заявку — полный возврат"
          : "Отмена до оказания услуги — полный возврат",
    };
  }

  if (params.cancelledBy === "INSTRUCTOR" || params.cancelledBy === "PLATFORM") {
    return { percent: 100, reason: "Отмена по инициативе инструктора или платформы — полный возврат" };
  }

  if (params.cancelledBy === "SYSTEM") {
    return { percent: 100, reason: "Техническая отмена — полный возврат" };
  }

  if (params.status === "LESSON_STARTED" || params.status === "COMPLETED") {
    return { percent: 0, reason: "Занятие уже начато или завершено" };
  }

  const lessonStart = getLessonStartAt({
    requestedStartDate: params.requestedStartDate,
    acceptedAt: params.acceptedAt,
  });

  if (!lessonStart) {
    if (params.status === "ACCEPTED" || params.status === "INSTRUCTOR_EN_ROUTE") {
      return { percent: 100, reason: "Отмена до начала занятия — полный возврат" };
    }
    return { percent: 0, reason: "Занятие уже начато или завершено" };
  }

  const hours = hoursUntilLesson(lessonStart, now);

  if (hours > CANCEL_CLIENT_FULL_REFUND_HOURS) {
    return {
      percent: 100,
      reason: `До занятия более ${CANCEL_CLIENT_FULL_REFUND_HOURS} ч — полный возврат`,
    };
  }
  if (hours >= CANCEL_CLIENT_PARTIAL_REFUND_HOURS) {
    return {
      percent: CANCEL_CLIENT_PARTIAL_PERCENT,
      reason: `От ${CANCEL_CLIENT_PARTIAL_REFUND_HOURS} до ${CANCEL_CLIENT_FULL_REFUND_HOURS} ч — возврат ${CANCEL_CLIENT_PARTIAL_PERCENT}%`,
    };
  }
  return {
    percent: 0,
    reason: `Менее ${CANCEL_CLIENT_PARTIAL_REFUND_HOURS} ч до занятия — без возврата`,
  };
}

/** Клиент: опоздание инструктора (ETA + grace, урок не начат). */
export function canClaimInstructorLateRefund(params: {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  instructorEtaAt: DateInput;
  lessonStartedAt: DateInput;
  lateRefundClaimedAt: DateInput;
  now?: Date;
}): boolean {
  const now = params.now ?? new Date();
  if (params.paymentStatus !== "PAID") return false;
  if (params.lateRefundClaimedAt) return false;
  if (params.lessonStartedAt) return false;
  if (params.status !== "ACCEPTED" && params.status !== "INSTRUCTOR_EN_ROUTE") return false;
  const etaMs = toDateMs(params.instructorEtaAt);
  if (etaMs == null) return false;
  const deadline = etaMs + INSTRUCTOR_LATE_GRACE_MINUTES * 60_000;
  return now.getTime() >= deadline;
}

export function refundAmountFromTotal(totalRub: number, percent: number): number {
  if (percent <= 0) return 0;
  if (percent >= 100) return Math.round(totalRub * 100) / 100;
  return Math.round(((totalRub * percent) / 100) * 100) / 100;
}

export const QUALITY_CLAIM_CATEGORIES = [
  "UNSAFE",
  "NO_LESSON",
  "SHORT_LESSON",
  "INCOMPETENCE",
  "WRONG_SERVICE",
] as const;

export type QualityClaimCategory = (typeof QUALITY_CLAIM_CATEGORIES)[number];

export const qualityClaimCategoryLabels: Record<QualityClaimCategory, string> = {
  UNSAFE: "Нарушение техники безопасности",
  NO_LESSON: "Урок не состоялся",
  SHORT_LESSON: "Сокращённое занятие",
  INCOMPETENCE: "Некомпетентное обучение",
  WRONG_SERVICE: "Несоответствие заказанным условиям",
};

function lessonActualMinutes(lessonStartedAt: DateInput, lessonEndedAt: DateInput): number | null {
  const startMs = toDateMs(lessonStartedAt);
  const endMs = toDateMs(lessonEndedAt);
  if (startMs == null || endMs == null) return null;
  const ms = endMs - startMs;
  if (ms < 0) return null;
  return Math.round(ms / 60_000);
}

function computeShortLessonRefundPercent(
  duration: LessonDuration,
  lessonStartedAt: DateInput,
  lessonEndedAt: DateInput,
): number | null {
  const actual = lessonActualMinutes(lessonStartedAt, lessonEndedAt);
  if (actual == null) return null;
  const expectedMinutes = durationHours(duration) * 60;
  if (expectedMinutes <= 0) return null;
  const ratioPercent = (actual / expectedMinutes) * 100;
  if (ratioPercent >= QUALITY_SHORT_LESSON_THRESHOLD_PERCENT) return null;
  const raw = Math.round(100 * (1 - actual / expectedMinutes));
  return Math.min(
    QUALITY_SHORT_LESSON_REFUND_MAX_PERCENT,
    Math.max(QUALITY_SHORT_LESSON_REFUND_MIN_PERCENT, raw),
  );
}

export function canClaimQualityRefund(params: {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  refundStatus: RefundStatus;
  refundPercent: number | null;
  qualityClaimedAt: DateInput;
  lessonEndedAt: DateInput;
  instructorPayoutPaidAt: DateInput;
  now?: Date;
}): boolean {
  const now = params.now ?? new Date();
  if (params.status !== "COMPLETED") return false;
  if (params.paymentStatus !== "PAID") return false;
  if (params.qualityClaimedAt) return false;
  if (params.instructorPayoutPaidAt) return false;
  if (params.refundStatus === "COMPLETED" || params.refundStatus === "PENDING") return false;
  if ((params.refundPercent ?? 0) > 0) return false;
  const endedMs = toDateMs(params.lessonEndedAt);
  if (endedMs == null) return false;
  const deadline = endedMs + QUALITY_CLAIM_WINDOW_HOURS * 3600 * 1000;
  return now.getTime() <= deadline;
}

/** Доля возврата по претензии о качестве (0–100). */
export function computeQualityRefundQuote(params: {
  category: QualityClaimCategory;
  description: string;
  duration: LessonDuration;
  lessonStartedAt: DateInput;
  lessonEndedAt: DateInput;
  clientRating: number | null;
}): RefundQuote {
  const description = params.description.trim();
  const rating = params.clientRating;

  if (params.category === "NO_LESSON") {
    const actual = lessonActualMinutes(params.lessonStartedAt, params.lessonEndedAt);
    if (!params.lessonStartedAt || actual == null || actual < QUALITY_NO_LESSON_MAX_MINUTES) {
      return { percent: 100, reason: qualityClaimCategoryLabels.NO_LESSON };
    }
    return {
      percent: 0,
      reason: "Урок отмечен как проведённый — для этой категории выберите «Сокращённое занятие» или другую причину",
    };
  }

  if (params.category === "SHORT_LESSON") {
    const percent = computeShortLessonRefundPercent(
      params.duration,
      params.lessonStartedAt,
      params.lessonEndedAt,
    );
    if (percent == null || percent <= 0) {
      return {
        percent: 0,
        reason: `Фактическая длительность не ниже ${QUALITY_SHORT_LESSON_THRESHOLD_PERCENT}% от заказанной`,
      };
    }
    return { percent, reason: qualityClaimCategoryLabels.SHORT_LESSON };
  }

  if (description.length < QUALITY_CLAIM_MIN_DESCRIPTION_CHARS) {
    return {
      percent: 0,
      reason: `Опишите ситуацию не менее чем в ${QUALITY_CLAIM_MIN_DESCRIPTION_CHARS} символов`,
    };
  }

  if (params.category === "UNSAFE") {
    if (rating == null) {
      return { percent: 0, reason: "Сначала оставьте оценку инструктору (нужна оценка ≤ 2)" };
    }
    if (rating > 2) {
      return { percent: 0, reason: "Для категории «безопасность» требуется оценка 2 или ниже" };
    }
    return { percent: 100, reason: qualityClaimCategoryLabels.UNSAFE };
  }

  if (params.category === "INCOMPETENCE" || params.category === "WRONG_SERVICE") {
    if (rating == null) {
      return { percent: 0, reason: "Сначала оставьте оценку инструктору (нужна оценка ≤ 3)" };
    }
    if (rating > 3) {
      return { percent: 0, reason: "Для этой категории требуется оценка 3 или ниже" };
    }
    return {
      percent: QUALITY_INCOMPETENCE_REFUND_PERCENT,
      reason: qualityClaimCategoryLabels[params.category],
    };
  }

  return { percent: 0, reason: "Неизвестная категория претензии" };
}
