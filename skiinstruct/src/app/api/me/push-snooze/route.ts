import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { verifyPushSnoozeToken } from "@/lib/support-push-token";
import { schedulePushSnooze, PUSH_SNOOZE_DELAY_MS } from "@/lib/services/push-snooze";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(8).optional(),
  title: z.string().trim().min(1).max(80).optional(),
  body: z.string().trim().max(200).optional(),
  url: z.string().trim().max(500).optional(),
  tag: z.string().trim().min(1).max(120).optional(),
  delayMinutes: z.number().int().min(5).max(24 * 60).optional(),
});

/** Отложить push на позже (кнопка в уведомлении Android). */
export async function POST(req: Request) {
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

  let userId: string | null = null;
  let title = parsed.data.title?.trim() || "Напоминание";
  let body = parsed.data.body?.trim() || "Отложенное сообщение";
  let url = parsed.data.url?.trim() || "/";
  let tag = parsed.data.tag?.trim() || `snooze-${Date.now()}`;

  if (parsed.data.token) {
    const snooze = verifyPushSnoozeToken(parsed.data.token);
    if (!snooze) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
    }
    userId = snooze.userId;
    title = snooze.title;
    body = snooze.body;
    url = snooze.url;
    tag = snooze.tag;
  } else {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!parsed.data.title || !parsed.data.tag) {
      return NextResponse.json({ error: "title and tag required" }, { status: 400 });
    }
    userId = session.user.id;
  }

  const delayMs = (parsed.data.delayMinutes ?? 60) * 60_000;
  const clamped = Math.min(Math.max(delayMs, 5 * 60_000), PUSH_SNOOZE_DELAY_MS * 24);

  schedulePushSnooze(
    userId,
    {
      title,
      body,
      url,
      tag,
      sound: "reminder",
    },
    clamped,
  );

  return NextResponse.json({
    ok: true,
    delayMinutes: Math.round(clamped / 60_000),
  });
}
