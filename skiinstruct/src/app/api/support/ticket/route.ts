import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { appendUserSupportMessage } from "@/lib/support-service";
import { ticketShortId } from "@/lib/support-ticket-access";
import { isMaxBridgeEnabled } from "@/lib/max-support";
import { SUPPORT_TICKET_COOKIE, supportEmail, supportMaxUrl } from "@/lib/support-config";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  guestEmail: z.string().email().max(120).optional(),
  guestName: z.string().trim().max(120).optional(),
  body: z.string().trim().min(1).max(4000).optional(),
});

function serializeTicket(
  ticket: {
    id: string;
    status: string;
    guestEmail: string | null;
    guestName: string | null;
    createdAt: Date;
    updatedAt: Date;
    messages: Array<{
      id: string;
      authorRole: string;
      body: string;
      createdAt: Date;
    }>;
    user?: { email: string; name: string | null } | null;
  },
) {
  return {
    id: ticket.id,
    shortId: ticketShortId(ticket.id),
    status: ticket.status,
    guestEmail: ticket.guestEmail,
    guestName: ticket.guestName,
    userEmail: ticket.user?.email ?? null,
    userName: ticket.user?.name ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    messages: ticket.messages.map((m) => ({
      id: m.id,
      authorRole: m.authorRole,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

function supportMetaResponse() {
  return {
    maxConfigured: isMaxBridgeEnabled(),
    maxUrl: supportMaxUrl(),
    supportEmail: supportEmail(),
  };
}

async function findOpenTicket(userId: string | null, accessToken: string | null) {
  if (userId) {
    return prisma.supportTicket.findFirst({
      where: { userId, status: "OPEN" },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        user: { select: { email: true, name: true } },
      },
    });
  }
  if (accessToken) {
    return prisma.supportTicket.findFirst({
      where: { accessToken, status: "OPEN" },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        user: { select: { email: true, name: true } },
      },
    });
  }
  return null;
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id?.trim() ?? null;
  const jar = await cookies();
  const token = jar.get(SUPPORT_TICKET_COOKIE)?.value?.trim() ?? null;

  const ticket = await findOpenTicket(userId, userId ? null : token);

  return NextResponse.json({
    ticket: ticket ? serializeTicket(ticket) : null,
    ...supportMetaResponse(),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id?.trim() ?? null;
  const jar = await cookies();
  const existingToken = jar.get(SUPPORT_TICKET_COOKIE)?.value?.trim() ?? null;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await findOpenTicket(userId, userId ? null : existingToken);
  if (existing) {
    return NextResponse.json({
      ticket: serializeTicket(existing),
      ...supportMetaResponse(),
    });
  }

  let guestEmail = parsed.data.guestEmail?.trim().toLowerCase();
  const guestName = parsed.data.guestName?.trim() || null;

  if (!userId) {
    if (!guestEmail) {
      return NextResponse.json({ error: "Укажите email для ответа поддержки" }, { status: 400 });
    }
  } else {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    guestEmail = user?.email.toLowerCase() ?? guestEmail;
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: userId ?? undefined,
      guestEmail: userId ? null : guestEmail,
      guestName: userId ? null : guestName,
      status: "OPEN",
    },
    include: {
      messages: true,
      user: { select: { email: true, name: true } },
    },
  });

  const res = NextResponse.json({
    ticket: serializeTicket(ticket),
    ...supportMetaResponse(),
  });

  if (!userId) {
    res.cookies.set(SUPPORT_TICKET_COOKIE, ticket.accessToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      secure: process.env.NODE_ENV === "production",
    });
  }

  if (parsed.data.body?.trim()) {
    await appendUserSupportMessage(ticket.id, parsed.data.body.trim(), {
      userId,
      guestEmail: guestEmail ?? ticket.guestEmail,
      guestName: guestName ?? ticket.guestName,
      userName: ticket.user?.name ?? null,
    });
    const refreshed = await prisma.supportTicket.findUnique({
      where: { id: ticket.id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        user: { select: { email: true, name: true } },
      },
    });
    if (refreshed) {
      return NextResponse.json({
        ticket: serializeTicket(refreshed),
        ...supportMetaResponse(),
      });
    }
  }

  return res;
}
