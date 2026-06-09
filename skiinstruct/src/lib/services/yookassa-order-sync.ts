import { prisma } from "@/lib/prisma";
import { saveCardFromPaymentMethodPayload } from "@/lib/services/client-yookassa-card";
import { completeOrderPrepayment } from "@/lib/services/order-prepayment";
import { fetchYooKassaPayment, isYooKassaConfigured } from "@/lib/yookassa";

export type SyncYooOrderPaymentResult = {
  paid: boolean;
  routed: boolean;
  status: string | null;
};

/**
 * Подтвердить оплату заказа через API ЮKassa (если webhook не дошёл — localhost, задержка сети).
 */
export async function syncYooOrderPayment(
  orderId: string,
  clientId: string,
): Promise<SyncYooOrderPaymentResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      clientId: true,
      status: true,
      paymentStatus: true,
      yookassaPaymentId: true,
      amountTotal: true,
    },
  });

  if (!order || order.clientId !== clientId) {
    throw new Error("Not found");
  }

  if (order.paymentStatus === "PAID") {
    return {
      paid: true,
      routed: order.status !== "AWAITING_PAYMENT",
      status: order.status,
    };
  }

  const paymentId = order.yookassaPaymentId?.trim();
  if (!paymentId) {
    return { paid: false, routed: false, status: order.status };
  }

  if (!isYooKassaConfigured()) {
    return { paid: false, routed: false, status: order.status };
  }

  const verified = await fetchYooKassaPayment(paymentId);
  if (!verified || verified.status !== "succeeded") {
    return { paid: false, routed: false, status: order.status };
  }

  await saveCardFromPaymentMethodPayload(order.clientId, verified.payment_method ?? undefined);

  const { routed } = await completeOrderPrepayment({
    orderId: order.id,
    paymentMethod: "CARD",
    yookassaPaymentId: paymentId,
    paymentRecordAmount: order.amountTotal != null ? Number(order.amountTotal) : undefined,
  });

  const refreshed = await prisma.order.findUnique({
    where: { id: order.id },
    select: { status: true },
  });

  return {
    paid: true,
    routed,
    status: refreshed?.status ?? null,
  };
}
