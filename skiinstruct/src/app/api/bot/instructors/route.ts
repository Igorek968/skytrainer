import { NextResponse } from "next/server";
import { z } from "zod";

import {
  authorizeBotApiRequest,
  botApiSecret,
  listBotInstructors,
} from "@/lib/bot-api";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  sport: z.string().trim().min(1).max(80).optional(),
  online: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

/**
 * Список инструкторов для Telegram/MAX-бота.
 * Authorization: Bearer <BOT_API_SECRET>
 * GET /api/bot/instructors?sport=лыжи&online=1
 */
export async function GET(req: Request) {
  if (!botApiSecret()) {
    return NextResponse.json(
      { error: "BOT_API_SECRET не настроен на сайте" },
      { status: 503 },
    );
  }
  if (!authorizeBotApiRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const instructors = await listBotInstructors({
    sport: parsed.data.sport,
    onlineOnly: parsed.data.online === true,
    limit: parsed.data.limit,
  });

  return NextResponse.json({ instructors });
}
