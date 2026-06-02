import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isMockCheckoutEnabled } from "@/lib/checkout-config";
import { getStripe } from "@/lib/stripe";
import { getClientCardStatus } from "@/lib/stripe-customer";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Карта доступна только клиенту" }, { status: 403 });
  }
  if (isMockCheckoutEnabled()) {
    return NextResponse.json({ hasCard: false, brand: null, last4: null, mock: true });
  }

  try {
    const stripe = getStripe();
    const card = await getClientCardStatus(stripe, session.user.email);
    return NextResponse.json(card);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось проверить карту";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
