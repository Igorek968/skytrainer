import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { completeOrderPrepayment } from "@/lib/services/order-prepayment";
import { isMockCheckoutEnabled } from "@/lib/checkout-config";
import { orderAmountDueRub } from "@/lib/services/referral";
import { isYooKassaConfigured } from "@/lib/yookassa";
import { getStripe } from "@/lib/stripe";
import { findStripeCustomerByEmail } from "@/lib/stripe-customer";

const bodySchema = z.object({
  orderId: z.string().cuid(),
});

export async function POST(req: Request) {
  try {
    const resolved = await requireClientSession();
    if (isApiErrorResponse(resolved)) return resolved;

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId } });
    if (!order || order.clientId !== resolved.userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
      return NextResponse.json({ error: "Оплата недоступна для этого заказа" }, { status: 400 });
    }

    if (isYooKassaConfigured()) {
      return NextResponse.json(
        { error: "Используйте ЮKassa", code: "USE_YOOKASSA" },
        { status: 400 },
      );
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
    const amountDue = orderAmountDueRub(order);

    if (isMockCheckoutEnabled()) {
      const mockIntentId = `mock_pi_${order.id.slice(0, 12)}_${Date.now()}`;
      await completeOrderPrepayment({
        orderId: order.id,
        paymentMethod: "CARD",
        stripePaymentIntentId: mockIntentId,
        paymentRecordAmount: amountDue,
      });
      return NextResponse.json({ url: `${origin}/client/orders/${order.id}?paid=1&mock=1` });
    }

    if (amountDue <= 0) {
      await completeOrderPrepayment({
        orderId: order.id,
        paymentMethod: "CARD",
        paymentRecordAmount: 0,
      });
      return NextResponse.json({ url: `${origin}/client/orders/${order.id}?paid=1&balance=1` });
    }

    const stripe = getStripe();
    const email = resolved.session.user.email?.trim().toLowerCase();
    const existingCustomer = await findStripeCustomerByEmail(stripe, email);
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: existingCustomer?.id,
      customer_email: existingCustomer ? undefined : email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "rub",
            unit_amount: Math.round(amountDue * 100),
            product_data: {
              name: `SkiInstruct — заказ ${order.id.slice(0, 8)}`,
            },
          },
        },
      ],
      success_url: `${origin}/client/orders/${order.id}?paid=1`,
      cancel_url: `${origin}/client/orders/${order.id}?paid=0`,
      metadata: { orderId: order.id },
      payment_intent_data: {
        metadata: { orderId: order.id },
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        stripeCheckoutSessionId: checkout.id,
        paymentMethod: "CARD",
      },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось создать оплату";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
