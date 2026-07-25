import { NextResponse } from "next/server";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const requests = await prisma.instructorPayoutRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      instructor: {
        select: {
          id: true,
          name: true,
          email: true,
          instructorProfile: { select: { payoutAccountHint: true } },
        },
      },
      orders: { select: { id: true, instructorShareAmount: true } },
    },
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      amountRub: Number(r.amountRub),
      status: r.status,
      adminNote: r.adminNote,
      processedAt: r.processedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      instructor: {
        id: r.instructor.id,
        name: r.instructor.name,
        email: r.instructor.email,
        payoutAccountHint: r.instructor.instructorProfile?.payoutAccountHint ?? null,
      },
      orderCount: r.orders.length,
    })),
  });
}
