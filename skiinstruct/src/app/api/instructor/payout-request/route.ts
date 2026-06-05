import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import {
  computeAvailablePayoutRub,
  createInstructorPayoutRequest,
} from "@/lib/services/payout-request";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireInstructorSession();
  if (isApiErrorResponse(auth)) return auth;

  const [availableRub, requests] = await Promise.all([
    computeAvailablePayoutRub(auth.userId),
    prisma.instructorPayoutRequest.findMany({
      where: { instructorId: auth.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        amountRub: true,
        status: true,
        adminNote: true,
        processedAt: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    availableRub,
    requests: requests.map((r) => ({
      ...r,
      amountRub: Number(r.amountRub),
      createdAt: r.createdAt.toISOString(),
      processedAt: r.processedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST() {
  const auth = await requireInstructorSession();
  if (isApiErrorResponse(auth)) return auth;

  try {
    const request = await createInstructorPayoutRequest(auth.userId);
    return NextResponse.json({
      ok: true,
      request: {
        id: request.id,
        amountRub: Number(request.amountRub),
        status: request.status,
        createdAt: request.createdAt.toISOString(),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось создать заявку";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
