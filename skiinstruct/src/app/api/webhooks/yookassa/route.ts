import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { completeOrderPrepayment } from "@/lib/services/order-prepayment";
import {
  fetchYooKassaPayment,
  isYooKassaConfigured,
  orderIdFromYooMetadata,
} from "@/lib/yookassa";

export const runtime = "nodejs";

type YooWebhookBody = {
  event?: string;
  object?: {
    id?: string;
    status?: string;
    metadata?: { orderId?: string; order_id?: string };
  };
};

async function resolveOrderId(paymentId: string, hintOrderId: string | null): Promise<string | null> {
  if (hintOrderId) return hintOrderId;

  const byPayment = await prisma.order.findFirst({
    where: { yookassaPaymentId: paymentId },
    select: { id: true },
  });
  return byPayment?.id ?? null;
}

export async function POST(req: Request) {
  let body: YooWebhookBody;
  try {
    body = (await req.json()) as YooWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event;
  const obj = body.object;
  const paymentId = obj?.id;

  if (event !== "payment.succeeded" || !paymentId) {
    return NextResponse.json({ received: true });
  }

  let orderId = orderIdFromYooMetadata(obj?.metadata);
  let status = obj?.status;

  if (isYooKassaConfigured()) {
    const verified = await fetchYooKassaPayment(paymentId);
    if (!verified || verified.status !== "succeeded") {
      return NextResponse.json({ received: true });
    }
    orderId = orderIdFromYooMetadata(verified.metadata) ?? orderId;
    status = verified.status;
  } else if (status !== "succeeded") {
    return NextResponse.json({ received: true });
  }

  orderId = await resolveOrderId(paymentId, orderId);
  if (!orderId) {
    return NextResponse.json({ received: true });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, paymentStatus: true, amountTotal: true },
    });

    if (!order) {
      return NextResponse.json({ received: true });
    }

    if (order.paymentStatus === "PAID") {
      await prisma.order.update({
        where: { id: orderId },
        data: { yookassaPaymentId: paymentId },
      });
      return NextResponse.json({ received: true });
    }

    await completeOrderPrepayment({
      orderId,
      yookassaPaymentId: paymentId,
      paymentRecordAmount: order.amountTotal != null ? Number(order.amountTotal) : undefined,
    });
  } catch (e) {
    console.error("[yookassa webhook]", e);
  }

  return NextResponse.json({ received: true });
}
