import type { Prisma } from "@prisma/client";

import { adminStaffRoleLabel } from "@/lib/admin-staff";
import { prisma } from "@/lib/prisma";

export async function writeAdminAudit(params: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  meta?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action.slice(0, 80),
        entity: params.entity.slice(0, 80),
        entityId: params.entityId ?? null,
        summary: params.summary.slice(0, 2000),
        meta: params.meta,
      },
    });
  } catch (e) {
    console.error("[admin-audit]", e instanceof Error ? e.message : e);
  }
}

export async function listAdminAuditLogs(limit = 80) {
  const rows = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(1, limit)),
  });
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter(Boolean))] as string[];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, email: true, name: true, role: true },
      })
    : [];
  const byId = new Map(actors.map((a) => [a.id, a]));

  return rows.map((r) => {
    const actor = r.actorId ? byId.get(r.actorId) : null;
    return {
      id: r.id,
      actorId: r.actorId,
      actorEmail: actor?.email ?? null,
      actorName: actor?.name ?? null,
      actorRole: actor?.role ?? null,
      actorLabel: actor
        ? `${actor.name?.trim() || actor.email} (${adminStaffRoleLabel(actor.role)})`
        : r.actorId
          ? `id:${r.actorId.slice(0, 8)}`
          : "система",
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      summary: r.summary,
      meta: r.meta,
      createdAt: r.createdAt.toISOString(),
    };
  });
}
