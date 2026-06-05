import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { markEventRegistrationPaid } from "@/lib/services/event-checkout";
import { completeOrderPrepayment } from "@/lib/services/order-prepayment";
import {
  eventRegistrationIdFromYooMetadata,
  fetchYooKassaPayment,
  isYooKassaConfigured,
  isYooKassaWebhookIpAllowed,
  orderIdFromYooMetadata,
  type YooKassaPaymentMetadata,
} from "@/lib/yookassa";

export const runtime = "nodejs";

type YooWebhookBody = {
  event?: string;
  object?: {
    id?: string;
    status?: string;
    metadata?: YooKassaPaymentMetadata;
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

async function resolveEventRegistrationId(
  paymentId: string,
  hintId: string | null,
): Promise<string | null> {
  if (hintId) return hintId;

  const byPayment = await prisma.eventRegistration.findFirst({
    where: { yookassaPaymentId: paymentId },
    select: { id: true },
  });
  return byPayment?.id ?? null;
}

export async function POST(req: Request) {
  if (!isYooKassaWebhookIpAllowed(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  let metadata = obj?.metadata;
  let status = obj?.status;

  if (isYooKassaConfigured()) {
    const verified = await fetchYooKassaPayment(paymentId);
    if (!verified || verified.status !== "succeeded") {
      return NextResponse.json({ received: true });
    }
    metadata = verified.metadata;
    status = verified.status;
  } else if (status !== "succeeded") {
    return NextResponse.json({ received: true });
  }

  const paymentType = metadata?.type;
  const eventRegistrationId = eventRegistrationIdFromYooMetadata(metadata);

  if (paymentType === "event" || eventRegistrationId) {
    const regId = await resolveEventRegistrationId(paymentId, eventRegistrationId);
    if (!regId) return NextResponse.json({ received: true });

    try {
      const reg = await prisma.eventRegistration.findUnique({
        where: { id: regId },
        select: { id: true, status: true },
      });
      if (!reg) return NextResponse.json({ received: true });
      if (reg.status === "PAID") {
        await prisma.eventRegistration.update({
          where: { id: regId },
          data: { yookassaPaymentId: paymentId },
        });
        return NextResponse.json({ received: true });
      }
      await markEventRegistrationPaid({ registrationId: regId, yookassaPaymentId: paymentId });
    } catch (e) {
      console.error("[yookassa webhook event]", e);
    }
    return NextResponse.json({ received: true });
  }

  let orderId = orderIdFromYooMetadata(metadata);
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
