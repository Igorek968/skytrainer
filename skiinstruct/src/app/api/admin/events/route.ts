import { NextResponse } from "next/server";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { isInstructorEventAutoApproveEnabled } from "@/lib/instructor-event-moderation-config";
import { serializeInstructorEvent } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const rows = await prisma.instructorEvent.findMany({
    where: { moderationStatus: "PENDING_REVIEW" },
    orderBy: { submittedAt: "asc" },
    take: 50,
    include: {
      instructor: { select: { id: true, name: true, email: true } },
    },
  });

  const autoApproveEnabled = isInstructorEventAutoApproveEnabled();

  return NextResponse.json({
    autoApproveEnabled,
    events: rows.map((row) => ({
      ...serializeInstructorEvent(row),
      instructor: row.instructor,
    })),
  });
}
