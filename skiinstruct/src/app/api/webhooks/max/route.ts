import { NextResponse } from "next/server";

import { handleMaxSupportUpdate } from "@/lib/max-support";

export const dynamic = "force-dynamic";

/** Webhook MAX Bot API — ответы оператора (reply) → веб-чат поддержки. */
export async function POST(req: Request) {
  const expected = process.env.MAX_WEBHOOK_SECRET?.trim();
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }
  } else {
    const header = req.headers.get("x-max-bot-api-secret");
    if (header !== expected) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const u = update as { update_type?: string };
    if (u.update_type === "message_created") {
      console.info("[max webhook] message_created");
    }
    await handleMaxSupportUpdate(update);
  } catch (e) {
    console.error("[max webhook]", e);
  }

  return NextResponse.json({ ok: true });
}
