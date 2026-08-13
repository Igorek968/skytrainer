import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  documentId: z.string().cuid(),
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectNote: z.string().max(500).optional(),
});

type Ctx = { params: Promise<{ userId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const { userId } = await ctx.params;
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

  const doc = await prisma.instructorComplianceDocument.findFirst({
    where: { id: parsed.data.documentId, userId },
  });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.instructorComplianceDocument.update({
    where: { id: doc.id },
    data: {
      status: parsed.data.status,
      rejectNote: parsed.data.status === "REJECTED" ? parsed.data.rejectNote ?? null : null,
    },
  });

  const { writeAdminAudit } = await import("@/lib/services/admin-audit");
  await writeAdminAudit({
    actorId: auth.userId,
    action: parsed.data.status === "APPROVED" ? "compliance.approve" : "compliance.reject",
    entity: "InstructorComplianceDocument",
    entityId: doc.id,
    summary: `${parsed.data.status === "APPROVED" ? "Одобрен" : "Отклонён"} документ ${doc.type} инструктора`,
    meta: { userId, type: doc.type, actorRole: auth.role, rejectNote: parsed.data.rejectNote ?? null },
  });

  return NextResponse.json({ document: updated });
}
