import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { appendUserSupportMessage } from "@/lib/support-service";
import { SUPPORT_TICKET_COOKIE } from "@/lib/support-config";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  body: z.string().trim().min(1).max(4000),
  captchaToken: z.string().trim().optional(),
});

async function resolveTicket(userId: string | null, token: string | null) {
  if (userId) {
    return prisma.supportTicket.findFirst({
      where: { userId, status: "OPEN" },
      orderBy: { updatedAt: "desc" },
      include: { user: { select: { email: true, name: true } } },
    });
  }
  if (!token) return null;
  return prisma.supportTicket.findFirst({
    where: { accessToken: token, status: "OPEN" },
    include: { user: { select: { email: true, name: true } } },
  });
}

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  const session = await auth();
  const userId = session?.user?.id?.trim() ?? null;
  const rateKey = userId ? `support-message:user:${userId}` : `support-message:ip:${ip}`;
  const maxPerMinute = userId ? 40 : 12;
  if (!rateLimit(rateKey, maxPerMinute, 60_000)) {
    return NextResponse.json({ error: "Слишком много сообщений. Подождите немного." }, { status: 429 });
  }

  const jar = await cookies();
  const token = jar.get(SUPPORT_TICKET_COOKIE)?.value?.trim() ?? null;

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
  const humanOk = await verifyTurnstileToken(parsed.data.captchaToken, ip);
  if (!humanOk) {
    return NextResponse.json({ error: "Подтвердите, что вы не робот." }, { status: 400 });
  }

  const ticket = await resolveTicket(userId, userId ? null : token);
  if (!ticket) {
    return NextResponse.json({ error: "Сначала откройте чат поддержки" }, { status: 404 });
  }

  const msg = await appendUserSupportMessage(ticket.id, parsed.data.body, {
    userId,
    guestEmail: ticket.user?.email ?? ticket.guestEmail,
    guestName: ticket.guestName,
    userName: ticket.user?.name ?? null,
  });

  return NextResponse.json({
    message: {
      id: msg.id,
      authorRole: msg.authorRole,
      body: msg.body,
      createdAt: msg.createdAt.toISOString(),
    },
  });
}
