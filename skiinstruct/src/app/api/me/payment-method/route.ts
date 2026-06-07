import { NextResponse } from "next/server";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import { getClientCardStatus } from "@/lib/services/client-yookassa-card";

export async function GET() {
  const resolved = await requireClientSession();
  if (isApiErrorResponse(resolved)) return resolved;
  if (resolved.session.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Карта доступна только клиенту" }, { status: 403 });
  }

  const card = await getClientCardStatus(resolved.userId);
  return NextResponse.json(card);
}
