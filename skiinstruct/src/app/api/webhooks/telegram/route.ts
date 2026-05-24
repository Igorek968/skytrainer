import { NextResponse } from "next/server";

import { handleTelegramSupportUpdate } from "@/lib/telegram-support";

export const dynamic = "force-dynamic";

/** Webhook Telegram Bot API — ответы оператора (reply) → веб-чат поддержки. */
export async function POST(req: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (expected) {
    const header = req.headers.get("x-telegram-bot-api-secret-token");
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
    await handleTelegramSupportUpdate(update);
  } catch (e) {
    console.error("[telegram webhook]", e);
  }

  return NextResponse.json({ ok: true });
}
