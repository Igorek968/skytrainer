import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import {
  getAdminAlertQueueCounts,
  listAdminAlerts,
  markAdminAlertsRead,
} from "@/lib/services/admin-alerts";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const [counts, items] = await Promise.all([
    getAdminAlertQueueCounts(),
    listAdminAlerts(50),
  ]);

  return NextResponse.json({
    counts,
    items,
    generatedAt: new Date().toISOString(),
  });
}

const patchSchema = z.object({
  /** Пусто / omit — прочитать все. */
  ids: z.array(z.string().min(1).max(64)).max(100).optional(),
});

export async function PATCH(req: Request) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const json = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const updated = await markAdminAlertsRead(parsed.data.ids);
  const counts = await getAdminAlertQueueCounts();
  return NextResponse.json({ ok: true, updated, counts });
}
