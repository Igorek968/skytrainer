import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { assignInstructorByQueue } from "@/lib/services/instructor-routing";
import { isMockCheckoutEnabled } from "@/lib/checkout-config";
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

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

    if (isMockCheckoutEnabled()) {
      const mockIntentId = `mock_pi_${order.id.slice(0, 12)}_${Date.now()}`;
      const beforeStatus = order.status;
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "PAID",
          paymentMethod: "CARD",
          stripePaymentIntentId: mockIntentId,
        },
      });
      if (beforeStatus === "AWAITING_PAYMENT") {
        const routed = await assignInstructorByQueue(order.id, "initial");
        if (!routed || routed.status === "EXPIRED") {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: "EXPIRED", pendingExpiresAt: null },
          });
        }
      }
      const exists = await prisma.payment.findFirst({
        where: { orderId: order.id, stripePaymentIntentId: mockIntentId },
      });
      if (!exists) {
        await prisma.payment.create({
          data: {
            orderId: order.id,
            amount: Number(order.amountTotal ?? 0),
            status: "PAID",
            stripePaymentIntentId: mockIntentId,
          },
        });
      }
      return NextResponse.json({ url: `${origin}/client/orders/${order.id}?paid=1&mock=1` });
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
            unit_amount: Math.round(Number(order.amountTotal) * 100),
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
