import { NextResponse } from "next/server";

import {
  authorizeBotApiRequest,
  botApiSecret,
  botOutboundWebhookBaseUrl,
} from "@/lib/bot-api";

export const dynamic = "force-dynamic";

/**
 * Проверка готовности сайта к работе с ботом.
 * Authorization: Bearer <BOT_API_SECRET>
 */
export async function GET(req: Request) {
  if (!botApiSecret()) {
    return NextResponse.json(
      {
        ok: false,
        error: "BOT_API_SECRET не настроен",
        inbound: false,
        outbound: false,
      },
      { status: 503 },
    );
  }
  if (!authorizeBotApiRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const outbound = Boolean(botOutboundWebhookBaseUrl());

  return NextResponse.json({
    ok: true,
    inbound: true,
    outbound,
    endpoints: {
      instructors: "/api/bot/instructors?sport=лыжи&online=1",
      health: "/api/bot/health",
    },
    outbound_hooks: outbound
      ? [
          "POST {BOT_OUTBOUND_WEBHOOK_BASE_URL}/hooks/instructor-approved",
          "POST {BOT_OUTBOUND_WEBHOOK_BASE_URL}/hooks/instructor-online",
          "POST {BOT_OUTBOUND_WEBHOOK_BASE_URL}/hooks/event-published",
        ]
      : [],
  });
}
