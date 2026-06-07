import type { PaymentMethod } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { assignInstructorByQueue } from "@/lib/services/instructor-routing";
import { finalizeReferralCreditSpend } from "@/lib/services/referral-payout";
import { maybeAwardReferralReward, orderAmountDueRub } from "@/lib/services/referral";

export async function completeOrderPrepayment(params: {
  orderId: string;
  paymentMethod?: PaymentMethod;
  yookassaPaymentId?: string | null;
  stripePaymentIntentId?: string | null;
  paymentRecordAmount?: number;
}): Promise<{ routed: boolean }> {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      status: true,
      amountTotal: true,
      paymentStatus: true,
      referralCreditAppliedRub: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  const prepayOk =
    order.status === "AWAITING_PAYMENT" &&
    order.paymentStatus === "PENDING" &&
    order.amountTotal != null;
  const legacyPostLessonPay =
    order.status === "COMPLETED" &&
    (order.paymentStatus === "PENDING" || order.paymentStatus === "FAILED") &&
    order.amountTotal != null;

  if (!prepayOk && !legacyPostLessonPay) {
    throw new Error("Оплата недоступна для этого заказа");
  }

  const beforeStatus = order.status;
  const amount = params.paymentRecordAmount ?? orderAmountDueRub(order);

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "PAID",
      paymentMethod: params.paymentMethod ?? "CARD",
      ...(params.yookassaPaymentId ? { yookassaPaymentId: params.yookassaPaymentId } : {}),
      ...(params.stripePaymentIntentId ? { stripePaymentIntentId: params.stripePaymentIntentId } : {}),
    },
  });

  let routed = false;
  if (beforeStatus === "AWAITING_PAYMENT") {
    const routedOrder = await assignInstructorByQueue(order.id, "initial");
    routed = Boolean(routedOrder);
    if (!routedOrder || routedOrder.status === "EXPIRED") {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "EXPIRED", pendingExpiresAt: null },
      });
    }
  }

  if (params.yookassaPaymentId) {
    const exists = await prisma.payment.findFirst({
      where: { orderId: order.id, yookassaPaymentId: params.yookassaPaymentId },
    });
    if (!exists) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount,
          status: "PAID",
          yookassaPaymentId: params.yookassaPaymentId,
        },
      });
    }
  } else if (params.stripePaymentIntentId) {
    const exists = await prisma.payment.findFirst({
      where: { orderId: order.id, stripePaymentIntentId: params.stripePaymentIntentId },
    });
    if (!exists) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount,
          status: "PAID",
          stripePaymentIntentId: params.stripePaymentIntentId,
        },
      });
    }
  }

  await finalizeReferralCreditSpend(order.id);

  const afterPay = await prisma.order.findUnique({
    where: { id: order.id },
    select: { status: true, paymentStatus: true },
  });
  if (afterPay?.status === "COMPLETED" && afterPay.paymentStatus === "PAID") {
    await maybeAwardReferralReward(order.id);
  }

  return { routed };
}
