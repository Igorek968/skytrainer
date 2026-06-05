import type { Prisma } from "@prisma/client";

import type { AdminOrderOverviewRow } from "@/features/admin/admin-overview-types";

export const orderOverviewSelect = {
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  flexibleInstructorInvite: true,
  urgentInvite: true,
  pendingExpiresAt: true,
  amountTotal: true,
  paymentStatus: true,
  client: { select: { name: true, email: true } },
  instructor: { select: { name: true, email: true } },
} as const;

export type OrderOverviewRow = Prisma.OrderGetPayload<{ select: typeof orderOverviewSelect }>;

function num(d: unknown): number {
  if (d == null) return 0;
  if (typeof d === "number") return Number.isFinite(d) ? d : 0;
  if (
    typeof d === "object" &&
    d !== null &&
    "toNumber" in d &&
    typeof (d as { toNumber: () => number }).toNumber === "function"
  ) {
    return (d as { toNumber: () => number }).toNumber();
  }
  const n = Number(d);
  return Number.isFinite(n) ? n : 0;
}

export function mapOrderOverviewRow(o: OrderOverviewRow): AdminOrderOverviewRow {
  return {
    id: o.id,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    flexibleInstructorInvite: o.flexibleInstructorInvite,
    urgentInvite: o.urgentInvite,
    pendingExpiresAt: o.pendingExpiresAt ? o.pendingExpiresAt.toISOString() : null,
    amountTotal: o.amountTotal != null ? num(o.amountTotal) : null,
    paymentStatus: o.paymentStatus,
    clientName: o.client.name,
    clientEmail: o.client.email,
    instructorName: o.instructor?.name ?? null,
  };
}
