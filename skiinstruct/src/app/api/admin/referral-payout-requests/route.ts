import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireFullAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { updateReferralPayoutRequestStatus } from "@/lib/services/referral-payout";

const patchSchema = z.object({
  status: z.enum(["PROCESSING", "COMPLETED", "REJECTED"]),
  adminNote: z.string().max(2000).optional().nullable(),
});

export async function GET() {
  const authResult = await requireFullAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const requests = await prisma.referralPayoutRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      user: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      amountRub: Number(r.amountRub),
      status: r.status,
      adminNote: r.adminNote,
      createdAt: r.createdAt.toISOString(),
      processedAt: r.processedAt?.toISOString() ?? null,
      user: r.user,
    })),
  });
}

type Ctx = { params: Promise<{ requestId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const authResult = await requireFullAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const { requestId } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await updateReferralPayoutRequestStatus({
      requestId,
      status: parsed.data.status,
      adminNote: parsed.data.adminNote,
    });
    return NextResponse.json({
      ok: true,
      request: {
        id: updated.id,
        status: updated.status,
        processedAt: updated.processedAt?.toISOString() ?? null,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось обновить заявку";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
