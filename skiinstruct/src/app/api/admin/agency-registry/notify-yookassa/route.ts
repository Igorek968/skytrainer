import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { notifyPendingYookassaInstructorContracts } from "@/lib/services/yookassa-instructor-contract-notify";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  force: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

/** Пакетная отправка заполненных договоров на почту ops (для ЮKassa). */
export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    // empty body ok
  }

  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await notifyPendingYookassaInstructorContracts({
    force: parsed.data.force,
    limit: parsed.data.limit,
  });
  return NextResponse.json({ ok: true, ...result });
}
