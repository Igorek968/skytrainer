import type { Order, OrderCancelledBy, Prisma } from "@prisma/client";

import { refundAmountFromTotal } from "@/lib/refund-policy";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { createYooKassaRefund, isYooKassaConfigured } from "@/lib/yookassa";
import { transitionOrderStatus } from "@/lib/services/order-service";
import { computeCancelRefundQuote } from "@/lib/refund-policy";

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
