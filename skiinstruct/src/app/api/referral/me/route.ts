import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { z } from "zod";

import { auth } from "@/auth";
import { PAYOUT_MIN_WITHDRAWAL_RUB } from "@/lib/legal-config";
import { prisma } from "@/lib/prisma";
import { canRequestWithdrawal } from "@/lib/services/order-payout";
import { createReferralPayoutRequest } from "@/lib/services/referral-payout";
import { getReferralStats, resolveUserPayoutAccountHint } from "@/lib/services/referral";

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

export async function GET() {
  const session = await auth();
  const authResult = requireReferrerSession(session);
  if (authResult instanceof NextResponse) return authResult;

  const [stats, payoutHint, payoutRequests] = await Promise.all([
    getReferralStats(authResult.userId),
    resolveUserPayoutAccountHint(authResult.userId, authResult.role),
    prisma.referralPayoutRequest.findMany({
      where: { userId: authResult.userId },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        amountRub: true,
        status: true,
        adminNote: true,
        processedAt: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    ...stats,
    payoutMinRub: PAYOUT_MIN_WITHDRAWAL_RUB,
    canWithdraw: canRequestWithdrawal(stats.balanceRub),
    payoutAccountHint: payoutHint,
    payoutRequests: payoutRequests.map((r) => ({
      ...r,
      amountRub: Number(r.amountRub),
      createdAt: r.createdAt.toISOString(),
      processedAt: r.processedAt?.toISOString() ?? null,
    })),
  });
}

const hintSchema = z.object({
  payoutAccountHint: z.string().trim().min(4).max(64),
});

export async function PATCH(req: Request) {
  const session = await auth();
  const authResult = requireReferrerSession(session);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.role !== "CLIENT") {
    return NextResponse.json(
      { error: "Реквизиты инструктора указываются в разделе документов" },
      { status: 400 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = hintSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: authResult.userId },
    data: { payoutAccountHint: parsed.data.payoutAccountHint },
  });

  return NextResponse.json({ ok: true, payoutAccountHint: parsed.data.payoutAccountHint });
}
