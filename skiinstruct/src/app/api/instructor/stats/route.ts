import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import {
  PAYOUT_MIN_WITHDRAWAL_RUB,
  PLATFORM_FEE_PERCENT,
} from "@/lib/legal-config";
import { formatPayoutWindowHint, canRequestWithdrawal } from "@/lib/services/order-payout";
import { computeAvailablePayoutRub } from "@/lib/services/payout-request";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const now = new Date();
  const completed = await prisma.order.findMany({
    where: {
      instructorId: userId,
      status: "COMPLETED",
      paymentStatus: "PAID",
    },
    select: {
      amountTotal: true,
      instructorShareAmount: true,
      platformFeePercent: true,
      payoutEligibleAt: true,
      instructorPayoutReleasedAt: true,
      npdReceiptUrl: true,
      lessonEndedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  let earnedTotal = 0;
  let pendingPayout = 0;
  let missingNpdReceipts = 0;

  for (const o of completed) {
    const share = Number(o.instructorShareAmount ?? 0);
    earnedTotal += share;
    const eligible = o.payoutEligibleAt && o.payoutEligibleAt <= now;
    if (!eligible && o.instructorPayoutReleasedAt) {
      pendingPayout += share;
    }
    if (!o.npdReceiptUrl && o.lessonEndedAt) {
      missingNpdReceipts += 1;
    }
  }

  const availableForPayout = await computeAvailablePayoutRub(userId);

  const gross = completed.reduce((acc, o) => acc + Number(o.amountTotal ?? 0), 0);

  return NextResponse.json({
    orders: completed.length,
    instructorShareTotal: earnedTotal,
    grossTotal: gross,
    platformFeePercent: PLATFORM_FEE_PERCENT,
    availableForPayout,
    pendingPayout,
    canWithdraw: canRequestWithdrawal(availableForPayout),
    payoutMinRub: PAYOUT_MIN_WITHDRAWAL_RUB,
    payoutWindowHint: formatPayoutWindowHint(),
    missingNpdReceipts,
  });
}
