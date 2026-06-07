import { NextResponse } from "next/server";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { createReferralPayoutRequest } from "@/lib/services/referral-payout";
import { getReferralStats } from "@/lib/services/referral";

function requireReferrerSession(session: Session | null) {
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role;
  if (role !== "CLIENT" && role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { userId: session.user.id, role };
}

export async function POST() {
  const session = await auth();
  const authResult = requireReferrerSession(session);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const request = await createReferralPayoutRequest(authResult.userId, authResult.role);
    const stats = await getReferralStats(authResult.userId);
    return NextResponse.json({
      ok: true,
      request: {
        id: request.id,
        amountRub: Number(request.amountRub),
        status: request.status,
        createdAt: request.createdAt.toISOString(),
      },
      balanceRub: stats.balanceRub,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось создать заявку";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
