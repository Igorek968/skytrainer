import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { ticketShortId } from "@/lib/support-ticket-access";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z.enum(["OPEN", "CLOSED", "all"]).optional().default("OPEN"),
  q: z.string().trim().max(120).optional(),
});

export async function GET(req: Request) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const status = parsed.data.status;
  const q = parsed.data.q?.trim();

  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(status !== "all" ? { status } : {}),
      ...(q
        ? {
            OR: [
              { guestEmail: { contains: q, mode: "insensitive" } },
              { guestName: { contains: q, mode: "insensitive" } },
              { user: { email: { contains: q, mode: "insensitive" } } },
              { user: { name: { contains: q, mode: "insensitive" } } },
              { id: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, body: true, authorRole: true, createdAt: true },
      },
      _count: { select: { messages: true } },
    },
  });

  const [openCount, closedCount] = await Promise.all([
    prisma.supportTicket.count({ where: { status: "OPEN" } }),
    prisma.supportTicket.count({ where: { status: "CLOSED" } }),
  ]);

  return NextResponse.json({
    counts: { open: openCount, closed: closedCount, all: openCount + closedCount },
    tickets: tickets.map((t) => {
      const last = t.messages[0] ?? null;
      const label =
        t.user?.name?.trim() ||
        t.user?.email ||
        t.guestName?.trim() ||
        t.guestEmail ||
        "Гость";
      return {
        id: t.id,
        shortId: ticketShortId(t.id),
        status: t.status,
        userId: t.userId,
        user: t.user,
        guestEmail: t.guestEmail,
        guestName: t.guestName,
        label,
        messageCount: t._count.messages,
        lastMessage: last
          ? {
              id: last.id,
              body: last.body.slice(0, 200),
              authorRole: last.authorRole,
              createdAt: last.createdAt.toISOString(),
            }
          : null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      };
    }),
  });
}
