import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import {
  markYookassaInstructorContractSent,
  notifyYookassaInstructorContract,
} from "@/lib/services/yookassa-instructor-contract-notify";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["notify", "mark_sent"]),
  force: z.boolean().optional(),
});

type Ctx = { params: Promise<{ userId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const { userId } = await ctx.params;
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

  if (parsed.data.action === "mark_sent") {
    await markYookassaInstructorContractSent(userId);
    return NextResponse.json({ ok: true });
  }

  const result = await notifyYookassaInstructorContract(userId, {
    force: parsed.data.force === true,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json(result);
}
