import type { Order, OrderCancelledBy, Prisma } from "@prisma/client";

import { refundAmountFromTotal } from "@/lib/refund-policy";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { createYooKassaRefund, isYooKassaConfigured } from "@/lib/yookassa";
import { transitionOrderStatus } from "@/lib/services/order-service";
import {
  canClaimQualityRefund,
  computeCancelRefundQuote,
  computeQualityRefundQuote,
  type QualityClaimCategory,
} from "@/lib/refund-policy";
import {
  applyInstructorLessonPenalty,
  shouldChargeInstructorLessonPenalty,
} from "@/lib/services/instructor-penalty";
import { INSTRUCTOR_NO_SHOW_PENALTY_PERCENT } from "@/lib/legal-config";

export type CancelOrderResult = {
  order: Order;
  refundPercent: number;
  refundAmount: number;
};

export async function cancelOrderWithRefund(params: {
  orderId: string;
  actorUserId: string;
  cancelledBy: OrderCancelledBy;
}): Promise<CancelOrderResult> {
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  const quote = computeCancelRefundQuote({
    cancelledBy: params.cancelledBy,
    status: order.status,
    paymentStatus: order.paymentStatus,
    requestedStartDate: order.requestedStartDate,
    acceptedAt: order.acceptedAt,
  });

  const totalRub = order.amountTotal != null ? Number(order.amountTotal) : 0;
  const refundAmount = refundAmountFromTotal(totalRub, quote.percent);

  let refundStatus: Order["refundStatus"] = "NOT_APPLICABLE";
  let refundNote = quote.reason;

  if (order.paymentStatus === "PAID" && refundAmount > 0) {
    refundStatus = "PENDING";
    try {
      await executePaymentRefund(order, refundAmount);
      refundStatus = "COMPLETED";
      refundNote = `${quote.reason}. Возврат ${refundAmount} ₽ инициирован.`;
    } catch (e) {
      refundStatus = "FAILED";
      refundNote = `${quote.reason}. Ошибка возврата: ${e instanceof Error ? e.message : "unknown"}`;
    }
  } else if (order.paymentStatus === "PAID" && quote.percent === 0) {
    refundStatus = "NOT_APPLICABLE";
  }

  const extra: Prisma.OrderUpdateInput = {
    cancelledBy: params.cancelledBy,
    refundPercent: quote.percent,
    refundAmount: refundAmount > 0 ? refundAmount : null,
    refundStatus,
    refundNote,
    pendingExpiresAt: null,
  };

  const updated = await transitionOrderStatus({
    orderId: params.orderId,
    actorUserId: params.actorUserId,
    to: "CANCELLED",
    extra,
  });

  if (
    order.instructorId &&
    order.paymentStatus === "PAID" &&
    totalRub > 0 &&
    shouldChargeInstructorLessonPenalty({
      cancelledBy: params.cancelledBy,
      order,
    })
  ) {
    await applyInstructorLessonPenalty({
      instructorId: order.instructorId,
      orderId: order.id,
      baseAmountRub: totalRub,
      reason: `Поздняя отмена занятия инструктором — штраф ${INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%`,
    });
  }

  if (refundStatus === "FAILED") {
    try {
      const { emitAdminRefundFailedAlert } = await import("@/lib/services/admin-alerts");
      await emitAdminRefundFailedAlert({
        orderId: params.orderId,
        amountRub: refundAmount,
        reason: refundNote,
      });
    } catch (e) {
      console.error("[admin-alert] cancel refund failed", e instanceof Error ? e.message : e);
    }
  }

  return {
    order: updated,
    refundPercent: quote.percent,
    refundAmount,
  };
}

export async function claimInstructorLateRefund(params: {
  orderId: string;
  actorUserId: string;
}): Promise<CancelOrderResult> {
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order || order.clientId !== params.actorUserId) throw new Error("FORBIDDEN");

  const totalRub = order.amountTotal != null ? Number(order.amountTotal) : 0;
  let refundStatus: Order["refundStatus"] = "PENDING";
  const refundAmount = totalRub;
  let refundNote = `Опоздание инструктора более 15 мин — полный возврат`;

  try {
    await executePaymentRefund(order, refundAmount);
    refundStatus = "COMPLETED";
  } catch (e) {
    refundStatus = "FAILED";
    refundNote += `. Ошибка: ${e instanceof Error ? e.message : "unknown"}`;
  }

  const updated = await transitionOrderStatus({
    orderId: params.orderId,
    actorUserId: params.actorUserId,
    to: "CANCELLED",
    extra: {
      cancelledBy: "PLATFORM",
      refundPercent: 100,
      refundAmount: refundAmount > 0 ? refundAmount : null,
      refundStatus,
      refundNote,
      lateRefundClaimedAt: new Date(),
      pendingExpiresAt: null,
    },
  });

  if (order.instructorId && totalRub > 0) {
    await applyInstructorLessonPenalty({
      instructorId: order.instructorId,
      orderId: order.id,
      baseAmountRub: totalRub,
      reason: `Неявка или опоздание инструктора — штраф ${INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%`,
    });
  }

  try {
    const { emitAdminLateRefundAlert, emitAdminRefundFailedAlert } = await import(
      "@/lib/services/admin-alerts"
    );
    const client = await prisma.user.findUnique({
      where: { id: params.actorUserId },
      select: { name: true, email: true },
    });
    const clientLabel = client?.name?.trim() || client?.email || "Клиент";
    await emitAdminLateRefundAlert({
      orderId: params.orderId,
      clientLabel,
      amountRub: refundAmount,
      refundFailed: refundStatus === "FAILED",
    });
    if (refundStatus === "FAILED") {
      await emitAdminRefundFailedAlert({
        orderId: params.orderId,
        amountRub: refundAmount,
        reason: refundNote,
      });
    }
  } catch (e) {
    console.error("[admin-alert] late refund", e instanceof Error ? e.message : e);
  }

  return { order: updated, refundPercent: 100, refundAmount };
}

/** Полный возврат для оплаченного заказа в EXPIRED (таймаут/отказ выбранного инструктора). */
export async function applyRefundForExpiredOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "EXPIRED" || order.paymentStatus !== "PAID") return;
  if (order.refundStatus === "COMPLETED" || order.refundStatus === "PENDING") return;

  const quote = computeCancelRefundQuote({
    cancelledBy: "PLATFORM",
    status: "EXPIRED",
    paymentStatus: order.paymentStatus,
    requestedStartDate: order.requestedStartDate,
    acceptedAt: order.acceptedAt,
  });

  const totalRub = order.amountTotal != null ? Number(order.amountTotal) : 0;
  const refundAmount = refundAmountFromTotal(totalRub, quote.percent);
  if (refundAmount <= 0) return;

  let refundStatus: Order["refundStatus"] = "PENDING";
  let refundNote = quote.reason;
  try {
    await executePaymentRefund(order, refundAmount);
    refundStatus = "COMPLETED";
    refundNote = `${quote.reason}. Возврат ${refundAmount} ₽ инициирован.`;
  } catch (e) {
    refundStatus = "FAILED";
    refundNote = `${quote.reason}. Ошибка возврата: ${e instanceof Error ? e.message : "unknown"}`;
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      ...(order.cancelledBy ? {} : { cancelledBy: "PLATFORM" as const }),
      refundPercent: quote.percent,
      refundAmount,
      refundStatus,
      refundNote,
    },
  });

  if (refundStatus === "FAILED") {
    try {
      const { emitAdminRefundFailedAlert } = await import("@/lib/services/admin-alerts");
      await emitAdminRefundFailedAlert({
        orderId,
        amountRub: refundAmount,
        reason: refundNote,
      });
    } catch (e) {
      console.error("[admin-alert] expired refund failed", e instanceof Error ? e.message : e);
    }
  }
}

export async function claimQualityRefund(params: {
  orderId: string;
  actorUserId: string;
  category: QualityClaimCategory;
  description: string;
}): Promise<CancelOrderResult> {
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order || order.clientId !== params.actorUserId) throw new Error("FORBIDDEN");

  if (
    !canClaimQualityRefund({
      status: order.status,
      paymentStatus: order.paymentStatus,
      refundStatus: order.refundStatus,
      refundPercent: order.refundPercent,
      qualityClaimedAt: order.qualityClaimedAt,
      lessonEndedAt: order.lessonEndedAt,
      instructorPayoutPaidAt: order.instructorPayoutPaidAt,
    })
  ) {
    throw new Error("QUALITY_CLAIM_NOT_ELIGIBLE");
  }

  const quote = computeQualityRefundQuote({
    category: params.category,
    description: params.description,
    duration: order.duration,
    lessonStartedAt: order.lessonStartedAt,
    lessonEndedAt: order.lessonEndedAt,
    clientRating: order.clientRating,
  });

  if (quote.percent <= 0) {
    throw new Error(quote.reason);
  }

  const totalRub = order.amountTotal != null ? Number(order.amountTotal) : 0;
  const refundAmount = refundAmountFromTotal(totalRub, quote.percent);

  let refundStatus: Order["refundStatus"] = "NOT_APPLICABLE";
  let refundNote = `${quote.reason}. Претензия: ${params.description.trim()}`;

  if (refundAmount > 0) {
    refundStatus = "PENDING";
    try {
      await executePaymentRefund(order, refundAmount);
      refundStatus = "COMPLETED";
      refundNote = `${quote.reason}. Возврат ${refundAmount} ₽ (${quote.percent}%) инициирован.`;
    } catch (e) {
      refundStatus = "FAILED";
      refundNote += `. Ошибка: ${e instanceof Error ? e.message : "unknown"}`;
    }
  }

  const instructorShareBefore =
    order.instructorShareAmount != null ? Number(order.instructorShareAmount) : 0;
  const instructorShareAfter =
    instructorShareBefore > 0
      ? Math.max(0, Math.round((instructorShareBefore * (100 - quote.percent)) / 100 * 100) / 100)
      : null;

  const updated = await prisma.order.update({
    where: { id: params.orderId },
    data: {
      refundPercent: quote.percent,
      refundAmount: refundAmount > 0 ? refundAmount : null,
      refundStatus,
      refundNote,
      qualityClaimCategory: params.category,
      qualityClaimDescription: params.description.trim(),
      qualityClaimedAt: new Date(),
      ...(instructorShareAfter != null ? { instructorShareAmount: instructorShareAfter } : {}),
    },
  });

  try {
    const { emitAdminQualityClaimAlert, emitAdminRefundFailedAlert } = await import(
      "@/lib/services/admin-alerts"
    );
    const { qualityClaimCategoryLabels } = await import("@/lib/refund-policy");
    const client = await prisma.user.findUnique({
      where: { id: params.actorUserId },
      select: { name: true, email: true },
    });
    await emitAdminQualityClaimAlert({
      orderId: params.orderId,
      categoryLabel: qualityClaimCategoryLabels[params.category] ?? params.category,
      clientLabel: client?.name?.trim() || client?.email || "Клиент",
    });
    if (refundStatus === "FAILED") {
      await emitAdminRefundFailedAlert({
        orderId: params.orderId,
        amountRub: refundAmount,
        reason: refundNote,
      });
    }
  } catch (e) {
    console.error("[admin-alert] quality claim", e instanceof Error ? e.message : e);
  }

  return {
    order: updated,
    refundPercent: quote.percent,
    refundAmount,
  };
}

/** Повтор неудачного возврата (админ). */
export async function retryFailedOrderRefund(params: {
  orderId: string;
}): Promise<{ refundStatus: Order["refundStatus"]; refundNote: string | null }> {
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.refundStatus !== "FAILED") {
    throw new Error("Повтор доступен только для статуса FAILED");
  }
  const amount =
    order.refundAmount != null
      ? Number(order.refundAmount)
      : order.amountTotal != null && order.refundPercent != null
        ? refundAmountFromTotal(Number(order.amountTotal), order.refundPercent)
        : 0;
  if (!(amount > 0)) throw new Error("Нет суммы для возврата");

  try {
    await executePaymentRefund(order, amount);
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        refundStatus: "COMPLETED",
        refundNote: `Повторный возврат ${amount} ₽ инициирован администратором.`,
      },
      select: { refundStatus: true, refundNote: true },
    });
    return updated;
  } catch (e) {
    const note = `Повтор возврата не удался: ${e instanceof Error ? e.message : "unknown"}`;
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { refundStatus: "FAILED", refundNote: note },
      select: { refundStatus: true, refundNote: true },
    });
    throw new Error(updated.refundNote ?? note);
  }
}

async function executePaymentRefund(order: Order, amountRub: number): Promise<void> {
  if (order.paymentStatus !== "PAID" || amountRub <= 0) return;

  const yooId = order.yookassaPaymentId?.trim();
  if (yooId) {
    if (!isYooKassaConfigured() && !yooId.startsWith("mock_yoo_")) {
      throw new Error("ЮKassa не настроена для возврата");
    }
    await createYooKassaRefund(yooId, amountRub);
    return;
  }

  const pi = order.stripePaymentIntentId?.trim();
  if (!pi) {
    throw new Error("Нет идентификатора платежа для возврата");
  }
  if (pi.startsWith("mock_pi_") || pi.startsWith("mock_event_")) {
    return;
  }

  const stripe = getStripe();
  const amountKopecks = Math.round(amountRub * 100);
  await stripe.refunds.create({
    payment_intent: pi,
    amount: amountKopecks,
  });
}
