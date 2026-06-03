import type { OrderCancelledBy, OrderStatus, PaymentStatus } from "@prisma/client";

import {
  CANCEL_CLIENT_FULL_REFUND_HOURS,
  CANCEL_CLIENT_PARTIAL_PERCENT,
  CANCEL_CLIENT_PARTIAL_REFUND_HOURS,
  INSTRUCTOR_LATE_GRACE_MINUTES,
} from "@/lib/legal-config";
import { getLessonStartAt, hoursUntilLesson } from "@/lib/lesson-schedule";

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

  // Новая логика: после принятия инструктором заявка невозвратная для клиента.
  if (
    params.cancelledBy === "CLIENT" &&
    (params.status === "ACCEPTED" ||
      params.status === "INSTRUCTOR_EN_ROUTE" ||
      params.status === "LESSON_STARTED" ||
      params.status === "COMPLETED")
  ) {
    return { percent: 0, reason: "После принятия инструктором заказ невозвратный" };
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
  instructorEtaAt: Date | null;
  lessonStartedAt: Date | null;
  lateRefundClaimedAt: Date | null;
  now?: Date;
}): boolean {
  const now = params.now ?? new Date();
  if (params.paymentStatus !== "PAID") return false;
  if (params.lateRefundClaimedAt) return false;
  if (params.lessonStartedAt) return false;
  if (params.status !== "ACCEPTED" && params.status !== "INSTRUCTOR_EN_ROUTE") return false;
  if (!params.instructorEtaAt) return false;
  const deadline = params.instructorEtaAt.getTime() + INSTRUCTOR_LATE_GRACE_MINUTES * 60_000;
  return now.getTime() >= deadline;
}

export function refundAmountFromTotal(totalRub: number, percent: number): number {
  if (percent <= 0) return 0;
  if (percent >= 100) return Math.round(totalRub * 100) / 100;
  return Math.round(((totalRub * percent) / 100) * 100) / 100;
}
