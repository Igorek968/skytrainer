import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import {
  getClientRatingsByInstructor,
  type InstructorRegistrationListItem,
} from "@/lib/instructor-event-registration";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const rows = await prisma.eventRegistration.findMany({
    where: {
      event: { instructorId: userId },
      status: { in: ["PAID", "PENDING_PAYMENT"] },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      client: { select: { id: true, name: true, email: true, image: true } },
      event: {
        select: {
          id: true,
          title: true,
          eventAt: true,
          moderationStatus: true,
        },
      },
    },
  });

  const ratings = await getClientRatingsByInstructor(
    userId,
    rows.map((r) => r.clientId),
  );

  const registrations: InstructorRegistrationListItem[] = rows.map((r) => {
    const rating = ratings.get(r.clientId);
    return {
      id: r.id,
      status: r.status,
      amountRub: Number(r.amountRub),
      paidAt: r.paidAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      client: {
        id: r.client.id,
        name: r.client.name,
        email: r.client.email,
        image: r.client.image,
        ratingAvg: rating?.avg ?? null,
        ratingCount: rating?.count ?? 0,
      },
      event: {
        id: r.event.id,
        title: r.event.title,
        eventAt: r.event.eventAt?.toISOString() ?? null,
        moderationStatus: r.event.moderationStatus,
      },
    };
  });

  return NextResponse.json({ registrations });
}
