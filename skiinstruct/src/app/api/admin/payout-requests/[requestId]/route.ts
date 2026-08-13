import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireFullAdminSession } from "@/lib/api-session";
import { updatePayoutRequestStatus } from "@/lib/services/payout-request";

const bodySchema = z.object({
  status: z.enum(["PROCESSING", "COMPLETED", "REJECTED"]),
  adminNote: z.string().max(2000).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const auth = await requireFullAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const { requestId } = await params;
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
    const updated = await updatePayoutRequestStatus({
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
