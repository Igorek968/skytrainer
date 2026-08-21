import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import { syncYooEventRegistrationPayment } from "@/lib/services/yookassa-event-sync";

const bodySchema = z.object({
  registrationId: z.string().cuid(),
});

export async function POST(req: Request) {
  const resolved = await requireClientSession();
  if (isApiErrorResponse(resolved)) return resolved;

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
    const result = await syncYooEventRegistrationPayment(
      parsed.data.registrationId,
      resolved.userId,
    );
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось проверить оплату";
    if (message === "Not found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[yookassa/sync-registration]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
