import { cookies } from "next/headers";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SUPPORT_TICKET_COOKIE } from "@/lib/support-config";

export async function resolveSupportTicketForRequest() {
  const session = await auth();
  const userId = session?.user?.id?.trim();

  if (userId) {
    const open = await prisma.supportTicket.findFirst({
      where: { userId, status: "OPEN" },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        user: { select: { email: true, name: true } },
      },
    });
    return { ticket: open, userId, guest: false as const };
  }

  const jar = await cookies();
  const token = jar.get(SUPPORT_TICKET_COOKIE)?.value?.trim();
  if (!token) return { ticket: null, userId: null, guest: true as const };

  const ticket = await prisma.supportTicket.findFirst({
    where: { accessToken: token, status: "OPEN" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  return { ticket, userId: null, guest: true as const };
}

export function ticketShortId(id: string): string {
  return id.length > 8 ? id.slice(-8) : id;
}
