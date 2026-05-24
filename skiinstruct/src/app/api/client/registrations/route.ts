import { NextResponse } from "next/server";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import type { ClientRegistrationListItem } from "@/lib/client-event-registration";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const resolved = await requireClientSession();
  if (isApiErrorResponse(resolved)) return resolved;

  const rows = await prisma.eventRegistration.findMany({
    where: { clientId: resolved.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      event: {
        select: {
          id: true,
          title: true,
          eventAt: true,
          priceRub: true,
          instructor: { select: { id: true, name: true } },
        },
      },
    },
  });

  const registrations: ClientRegistrationListItem[] = rows.map((r) => ({
    id: r.id,
    status: r.status,
    amountRub: Number(r.amountRub),
    paidAt: r.paidAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    event: {
      id: r.event.id,
      title: r.event.title,
      eventAt: r.event.eventAt?.toISOString() ?? null,
      priceRub: r.event.priceRub,
    },
    instructor: {
      id: r.event.instructor.id,
      name: r.event.instructor.name,
    },
  }));

  return NextResponse.json({ registrations });
}
