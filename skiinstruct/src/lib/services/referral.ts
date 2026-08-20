import { randomBytes } from "crypto";

import { Prisma } from "@prisma/client";

import {
  REFERRAL_COOKIE_MAX_AGE_DAYS,
  REFERRAL_COOKIE_NAME,
  REFERRAL_MAX_ORDERS_PER_CLIENT,
  REFERRAL_PROGRAM_END_DATE,
  REFERRAL_REWARD_RUB,
} from "@/lib/legal-config";
import { normalizeReferralCode, referralCookieHelpText } from "@/lib/referral-cookie";
import { slugifyRu } from "@/lib/seo-slug";
import { prisma } from "@/lib/prisma";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export { REFERRAL_COOKIE_NAME, REFERRAL_COOKIE_MAX_AGE_DAYS, normalizeReferralCode };

function randomReferralCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

function referralProgramEndsAtIso(): string {
  return `${REFERRAL_PROGRAM_END_DATE}T23:59:59+03:00`;
}

function referralProgramActiveNow(): boolean {
  const endsAt = Date.parse(referralProgramEndsAtIso());
  return Number.isFinite(endsAt) ? Date.now() <= endsAt : true;
}

function buildInstructorReferralSlug(nickname: string | null | undefined): string | null {
  const slug = slugifyRu(String(nickname ?? "").trim());
  if (!slug || slug === "page") return null;
  return normalizeReferralCode(slug);
}

export async function ensureUserReferralCode(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true, role: true, nickname: true },
  });
  if (existing?.referralCode) return existing.referralCode;

  // Для инструкторов фиксируем человекочитаемый slug по nickname.
  if (existing?.role === "INSTRUCTOR") {
    const baseSlug = buildInstructorReferralSlug(existing.nickname);
    if (baseSlug) {
      for (let n = 0; n < 20; n++) {
        const candidate = n === 0 ? baseSlug : `${baseSlug}-${n + 1}`;
        try {
          const updated = await prisma.user.update({
            where: { id: userId },
            data: { referralCode: candidate },
            select: { referralCode: true },
          });
          return updated.referralCode!;
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
          throw e;
        }
      }
    }
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomReferralCode().toLowerCase();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
        select: { referralCode: true },
      });
      return updated.referralCode!;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("Не удалось сгенерировать реферальный код");
}

export async function bindReferralByCode(userId: string, rawCode: string | null | undefined): Promise<void> {
  const code = normalizeReferralCode(rawCode);
  if (!code) return;

  const [user, referrer] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, referredById: true },
    }),
    prisma.user.findFirst({
      where: { referralCode: { equals: code, mode: "insensitive" } },
      select: { id: true, role: true },
    }),
  ]);

  if (!user || user.role !== "CLIENT") return;
  if (user.referredById) return;
  if (!referrer) return;
  if (referrer.id === userId) return;
  if (referrer.role !== "CLIENT" && referrer.role !== "INSTRUCTOR") return;

  await prisma.user.update({
    where: { id: userId },
    data: { referredById: referrer.id },
  });
}

export async function bindReferralFromCookie(userId: string): Promise<void> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const code = cookieStore.get(REFERRAL_COOKIE_NAME)?.value;
    await bindReferralByCode(userId, code);
  } catch {
    /* authorize / edge contexts without cookies */
  }
}

function orderEligibleForReferralReward(order: {
  status: string;
  paymentStatus: string;
  refundStatus: string;
  refundPercent: number | null;
}): boolean {
  if (order.status !== "COMPLETED" || order.paymentStatus !== "PAID") return false;
  if (order.refundStatus === "COMPLETED" && (order.refundPercent ?? 0) >= 100) return false;
  return true;
}

/** Начисляет рефереру 250 ₽, если заказ завершён и оплачен (до 4 заказов на клиента). */
export async function maybeAwardReferralReward(orderId: string): Promise<void> {
  if (!referralProgramActiveNow()) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      clientId: true,
      status: true,
      paymentStatus: true,
      refundStatus: true,
      refundPercent: true,
      client: { select: { referredById: true } },
    },
  });
  if (!order?.client.referredById) return;
  if (!orderEligibleForReferralReward(order)) return;

  const referrerId = order.client.referredById;
  const referredClientId = order.clientId;

  await prisma.$transaction(async (tx) => {
    const existingForOrder = await tx.referralReward.findUnique({
      where: { orderId },
      select: { id: true },
    });
    if (existingForOrder) return;

    const priorCount = await tx.referralReward.count({
      where: { referrerId, referredClientId },
    });
    if (priorCount >= REFERRAL_MAX_ORDERS_PER_CLIENT) return;

    await tx.referralReward.create({
      data: {
        referrerId,
        referredClientId,
        orderId,
        amountRub: REFERRAL_REWARD_RUB.toFixed(2),
        orderIndex: priorCount + 1,
      },
    });

    await tx.user.update({
      where: { id: referrerId },
      data: { referralBalanceRub: { increment: REFERRAL_REWARD_RUB } },
    });
  });
}

export async function resolveUserPayoutAccountHint(userId: string, role: string): Promise<string | null> {
  if (role === "INSTRUCTOR") {
    const profile = await prisma.instructorProfile.findUnique({
      where: { userId },
      select: { payoutAccountHint: true },
    });
    return profile?.payoutAccountHint?.trim() || null;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { payoutAccountHint: true },
  });
  return user?.payoutAccountHint?.trim() || null;
}

export async function getReferralStats(userId: string) {
  const [user, invitedCount, rewardsAgg, rewards] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { referralBalanceRub: true, referralCode: true, email: true },
    }),
    prisma.user.count({ where: { referredById: userId } }),
    prisma.referralReward.aggregate({
      where: { referrerId: userId },
      _sum: { amountRub: true },
      _count: { _all: true },
    }),
    prisma.referralReward.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        amountRub: true,
        orderIndex: true,
        createdAt: true,
        referredClientId: true,
      },
    }),
  ]);

  const code = user?.referralCode ?? (await ensureUserReferralCode(userId));
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3001";
  const programEndsAt = referralProgramEndsAtIso();

  return {
    referralCode: code,
    referralLink: `${origin.replace(/\/+$/, "")}/?ref=${code}`,
    balanceRub: Number(user?.referralBalanceRub ?? 0),
    invitedCount,
    rewardsCount: rewardsAgg._count._all,
    earnedTotalRub: Number(rewardsAgg._sum.amountRub ?? 0),
    rewardPerOrderRub: REFERRAL_REWARD_RUB,
    maxOrdersPerInvitee: REFERRAL_MAX_ORDERS_PER_CLIENT,
    programEndsAt,
    cookieHelpText: referralCookieHelpText({
      code,
      email: user?.email,
      programEndsAt,
    }),
    recentRewards: rewards.map((r) => ({
      id: r.id,
      amountRub: Number(r.amountRub),
      orderIndex: r.orderIndex,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export function orderAmountDueRub(order: {
  amountTotal: Prisma.Decimal | number | null;
  referralCreditAppliedRub?: Prisma.Decimal | number | null;
}): number {
  const total = Number(order.amountTotal ?? 0);
  const credit = Number(order.referralCreditAppliedRub ?? 0);
  return Math.max(0, Math.round((total - credit) * 100) / 100);
}
