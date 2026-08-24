import { NextResponse } from "next/server";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import { isMockCheckoutEnabled } from "@/lib/checkout-config";
import {
  getClientCardStatus,
  unbindClientYooPaymentMethod,
} from "@/lib/services/client-yookassa-card";

export async function GET() {
  const resolved = await requireClientSession();
  if (isApiErrorResponse(resolved)) return resolved;
  if (resolved.session.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Карта доступна только клиенту" }, { status: 403 });
  }

  const card = await getClientCardStatus(resolved.userId);
  return NextResponse.json({ ...card, testCheckout: isMockCheckoutEnabled() });
}

/** Отвязка сохранённой карты (удаление payment_method_id из системы). */
export async function DELETE() {
  const resolved = await requireClientSession();
  if (isApiErrorResponse(resolved)) return resolved;
  if (resolved.session.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Карта доступна только клиенту" }, { status: 403 });
  }

  const before = await getClientCardStatus(resolved.userId);
  if (!before.hasCard && !before.pendingBind) {
    return NextResponse.json({ error: "Привязанная карта не найдена" }, { status: 400 });
  }

  const card = await unbindClientYooPaymentMethod(resolved.userId);
  return NextResponse.json({
    ok: true,
    ...card,
    testCheckout: isMockCheckoutEnabled(),
  });
}
