import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { assignInstructorByQueue } from "@/lib/services/instructor-routing";
import { getStripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !whSecret) {
    return NextResponse.json({ error: "Missing webhook config" }, { status: 400 });
  }

  let event: import("stripe").Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as import("stripe").Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    const pi = session.payment_intent;
    if (orderId) {
      const before = await prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });

      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: "PAID",
          stripePaymentIntentId: typeof pi === "string" ? pi : pi?.id,
        },
      });

      if (before?.status === "AWAITING_PAYMENT") {
        const routed = await assignInstructorByQueue(orderId, "initial");
        if (!routed || routed.status === "EXPIRED") {
          await prisma.order.update({
            where: { id: orderId },
            data: { status: "EXPIRED", pendingExpiresAt: null },
          });
        }
      }

      const amount = session.amount_total;
      const piId = typeof pi === "string" ? pi : pi?.id;
      if (amount != null && piId) {
        const exists = await prisma.payment.findFirst({
          where: { orderId, stripePaymentIntentId: piId },
        });
        if (!exists) {
          await prisma.payment.create({
            data: {
              orderId,
              amount: amount / 100,
              status: "PAID",
              stripePaymentIntentId: piId,
            },
          });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
