import type { RefundStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { qualityClaimCategoryLabels, type QualityClaimCategory } from "@/lib/refund-policy";

export type AdminQualityClaimRow = {
  orderId: string;
  claimedAt: string;
  category: QualityClaimCategory;
  categoryLabel: string;
  description: string | null;
  refundPercent: number | null;
  refundAmount: number | null;
  refundStatus: RefundStatus;
  refundNote: string | null;
  clientId: string;
  clientName: string | null;
  clientEmail: string | null;
  instructorId: string | null;
  instructorName: string | null;
  lessonStartedAt: string | null;
  lessonEndedAt: string | null;
  clientRating: number | null;
  amountTotal: number | null;
};

export async function fetchAdminQualityClaims(params?: {
  limit?: number;
  failedOnly?: boolean;
}): Promise<AdminQualityClaimRow[]> {
  const limit = Math.min(Math.max(params?.limit ?? 100, 1), 500);

  const orders = await prisma.order.findMany({
    where: {
      qualityClaimedAt: { not: null },
      ...(params?.failedOnly ? { refundStatus: "FAILED" } : {}),
    },
    orderBy: { qualityClaimedAt: "desc" },
    take: limit,
    select: {
      id: true,
      qualityClaimedAt: true,
      qualityClaimCategory: true,
      qualityClaimDescription: true,
      refundPercent: true,
      refundAmount: true,
      refundStatus: true,
      refundNote: true,
      lessonStartedAt: true,
      lessonEndedAt: true,
      clientRating: true,
      amountTotal: true,
      client: { select: { id: true, name: true, email: true } },
      instructor: { select: { id: true, name: true } },
    },
  });

  return orders.map((o) => {
    const category = (o.qualityClaimCategory ?? "INCOMPETENCE") as QualityClaimCategory;
    return {
      orderId: o.id,
      claimedAt: o.qualityClaimedAt!.toISOString(),
      category,
      categoryLabel: qualityClaimCategoryLabels[category] ?? o.qualityClaimCategory ?? "—",
      description: o.qualityClaimDescription,
      refundPercent: o.refundPercent,
      refundAmount: o.refundAmount != null ? Number(o.refundAmount) : null,
      refundStatus: o.refundStatus,
      refundNote: o.refundNote,
      clientId: o.client.id,
      clientName: o.client.name,
      clientEmail: o.client.email,
      instructorId: o.instructor?.id ?? null,
      instructorName: o.instructor?.name ?? null,
      lessonStartedAt: o.lessonStartedAt?.toISOString() ?? null,
      lessonEndedAt: o.lessonEndedAt?.toISOString() ?? null,
      clientRating: o.clientRating,
      amountTotal: o.amountTotal != null ? Number(o.amountTotal) : null,
    };
  });
}
