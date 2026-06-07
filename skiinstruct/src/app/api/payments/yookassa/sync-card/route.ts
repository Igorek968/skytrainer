import { NextResponse } from "next/server";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import { syncPendingYooCardBind } from "@/lib/services/client-yookassa-card";

export async function POST() {
  const resolved = await requireClientSession();
  if (isApiErrorResponse(resolved)) return resolved;

  const card = await syncPendingYooCardBind(resolved.userId);
  return NextResponse.json(card);
}
