import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import { applyReferralCreditToOrder } from "@/lib/services/referral-payout";
import { orderAmountDueRub } from "@/lib/services/referral";

const bodySchema = z.object({
  useCredit: z.boolean(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const resolved = await requireClientSession();
  if (isApiErrorResponse(resolved)) return resolved;

  const { id } = await ctx.params;

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

  try {
    const order = await applyReferralCreditToOrder({
      orderId: id,
      clientId: resolved.userId,
      useCredit: parsed.data.useCredit,
    });
    return NextResponse.json({
      ok: true,
      referralCreditAppliedRub: order.referralCreditAppliedRub
        ? Number(order.referralCreditAppliedRub)
        : 0,
      amountDueRub: orderAmountDueRub(order),
      amountTotalRub: Number(order.amountTotal ?? 0),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось применить баланс";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
