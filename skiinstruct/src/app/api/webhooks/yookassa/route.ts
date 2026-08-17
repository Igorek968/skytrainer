import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { markEventRegistrationPaid } from "@/lib/services/event-checkout";
import {
  saveClientYooPaymentMethod,
  saveCardFromPaymentMethodPayload,
} from "@/lib/services/client-yookassa-card";
import { completeOrderPrepayment } from "@/lib/services/order-prepayment";
import {
  eventRegistrationIdFromYooMetadata,
  extractYooCardLabel,
  fetchYooKassaPayment,
  fetchYooKassaPaymentMethod,
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
    saved?: boolean;
    card?: { last4?: string; card_type?: string; brand?: string };
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

async function handlePaymentMethodActive(paymentMethodId: string): Promise<void> {
  const users = await prisma.user.findMany({
    where: { yookassaPendingBindId: paymentMethodId },
    select: { id: true },
    take: 5,
  });
  if (!users.length) return;

  const method = await fetchYooKassaPaymentMethod(paymentMethodId);
  if (!method || method.status !== "active" || !method.saved) return;

  const { last4, brand } = extractYooCardLabel(method);
  for (const user of users) {
    await saveClientYooPaymentMethod(user.id, method.id, { last4, brand });
  }
}

export async function POST(req: Request) {
  if (!isYooKassaConfigured()) {
    return NextResponse.json({ error: "YooKassa not configured" }, { status: 503 });
  }

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

  if (event === "payment_method.active" && obj?.id) {
    try {
      await handlePaymentMethodActive(obj.id);
    } catch (e) {
      console.error("[yookassa webhook payment_method]", e);
    }
    return NextResponse.json({ received: true });
  }

  const paymentId = obj?.id;

  if (event !== "payment.succeeded" || !paymentId) {
    return NextResponse.json({ received: true });
  }

  const verified = await fetchYooKassaPayment(paymentId);
  if (!verified || verified.status !== "succeeded") {
    return NextResponse.json({ received: true });
  }
  const metadata = verified.metadata;
  const paymentMethod = verified.payment_method;

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
      select: { id: true, clientId: true, paymentStatus: true, amountTotal: true },
    });

    if (!order) {
      return NextResponse.json({ received: true });
    }

    await saveCardFromPaymentMethodPayload(order.clientId, paymentMethod ?? undefined);

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
