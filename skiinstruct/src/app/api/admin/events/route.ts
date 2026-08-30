import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { isInstructorEventAutoApproveEnabled } from "@/lib/instructor-event-moderation-config";
import { serializeInstructorEvent } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z.enum(["PENDING_REVIEW", "PUBLISHED", "ARCHIVED"]).optional().default("PENDING_REVIEW"),
});

export async function GET(req: Request) {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const status = parsed.data.status;
  const rows = await prisma.instructorEvent.findMany({
    where: { moderationStatus: status },
    orderBy:
      status === "PENDING_REVIEW"
        ? { submittedAt: "asc" }
        : [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: status === "PUBLISHED" ? 100 : 50,
    include: {
      instructor: { select: { id: true, name: true, email: true } },
      catalogItem: { select: { id: true, title: true, status: true, citySlug: true, photoUrl: true } },
    },
  });

  const autoApproveEnabled = isInstructorEventAutoApproveEnabled();

  return NextResponse.json({
    autoApproveEnabled,
    events: rows.map((row) => ({
      ...serializeInstructorEvent(row),
      instructor: row.instructor,
      catalogItem: row.catalogItem,
    })),
  });
}
