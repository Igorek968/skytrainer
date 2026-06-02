import { NextResponse } from "next/server";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import { isMockCheckoutEnabled } from "@/lib/checkout-config";
import { getStripe } from "@/lib/stripe";
import { findStripeCustomerByEmail } from "@/lib/stripe-customer";

export async function POST() {
  try {
    const resolved = await requireClientSession();
    if (isApiErrorResponse(resolved)) return resolved;

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
    if (isMockCheckoutEnabled()) {
      return NextResponse.json({ url: `${origin}/client?card=mock` });
    }

    const stripe = getStripe();
    const email = resolved.session.user.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "У аккаунта не указан email" }, { status: 400 });
    }

    let customer = await findStripeCustomerByEmail(stripe, email);
    if (!customer) {
      customer = await stripe.customers.create({
        email,
        name: resolved.session.user.name ?? undefined,
        metadata: { userId: resolved.userId },
      });
    }

    const setup = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: customer.id,
      success_url: `${origin}/client?card=updated`,
      cancel_url: `${origin}/client?card=cancelled`,
    });

    return NextResponse.json({ url: setup.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось создать сессию привязки";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
