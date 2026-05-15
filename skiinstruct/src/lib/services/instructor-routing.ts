import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { computeTotals } from "@/lib/pricing";
import {
  instructorMatchesAvailability,
  normalizeText,
  weekdaysFromOrderUtcDates,
} from "@/lib/services/instructor-match";
import { haversineKm } from "@/lib/services/geo";
import { orderRelaxedInstructorTiming, orderSpansMultipleLessonDays } from "@/shared/lib/order-flex";
import { lessonTimeWindowLineFromNotes } from "@/shared/lib/order-lesson-times";

/** Prisma Decimal(10,2): числа JS с плавающей точкой и NaN ломали запись. */
function orderMoneyDecimal(value: number): Prisma.Decimal {
  const safe = Number.isFinite(value) && value >= 0 ? value : 0;
  return new Prisma.Decimal(safe.toFixed(2));
}

const RADIUS_KM = 5;
/** Инструктору даётся столько времени на принятие заявки. */
export const RESPONSE_WINDOW_MS = 60_000;

const SKILL_LEVEL_TO_LABEL: Record<string, string> = {
  BEGINNER: "Для начинающих",
  INTERMEDIATE: "Средний",
  ADVANCED: "Продвинутый",
};
const DURATION_TO_LABEL: Record<string, string> = {
  ONE_HOUR: "1 ч",
  TWO_HOURS: "2 ч",
  HALF_DAY: "Полдня",
  FULL_DAY: "День",
};

async function buildNotificationBody(
  order: {
    id: string;
    requestedStartDate: Date | null;
    requestedEndDate: Date | null;
    requestedDays: number | null;
    flexibleInstructorInvite: boolean;
    duration: string;
    languagePref: string;
    skillLevel: string;
    notes: string | null;
  },
  opts: { flexibleInvite: boolean; relaxedTiming: boolean }
) {
  const start = order.requestedStartDate ? order.requestedStartDate.toISOString().slice(0, 10) : "не указана";
  const end = order.requestedEndDate ? order.requestedEndDate.toISOString().slice(0, 10) : start;
  const days = order.requestedDays ?? 1;
  const timingLine = opts.flexibleInvite
    ? "Запись на выбранные даты (инструктор мог быть офлайн). Ответьте, когда будете готовы — без ограничения по времени."
    : opts.relaxedTiming
      ? "Несколько дней: примите заявку без отсчёта 60 секунд. ETA до точки встречи для такого заказа не используется."
      : "На принятие заявки: 60 секунд.";
  const timeWindow = lessonTimeWindowLineFromNotes(order.notes);
  return [
    `Новая заявка #${order.id}`,
    `Период: ${start}${end ? ` - ${end}` : ""} (${days} дн.)`,
    timeWindow,
    `Уровень: ${order.skillLevel}`,
    `Язык: ${order.languagePref}`,
    `Длительность: ${order.duration}`,
    timingLine,
    order.notes ? `Комментарий: ${order.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function buildInstructorQueueForOrder(input: {
  meetLat: number;
  meetLng: number;
  languagePref: string;
  skillLevel: string;
  duration: string;
  requestedStartDate: Date | null;
  requestedEndDate: Date | null;
  requestedDays: number | null;
}): Promise<string[]> {
  const skillLabel = SKILL_LEVEL_TO_LABEL[input.skillLevel] ?? null;
  const durationLabel = DURATION_TO_LABEL[input.duration] ?? null;
  const languageNeedle = normalizeText(input.languagePref);
  const requestedDays = weekdaysFromOrderUtcDates(
    input.requestedStartDate,
    input.requestedEndDate,
    input.requestedDays ?? 1,
  );

  const users = await prisma.user.findMany({
    where: {
      role: "INSTRUCTOR",
      instructorProfile: {
        isOnline: true,
        verificationStatus: "APPROVED",
        lat: { not: null },
        lng: { not: null },
      },
    },
    include: { instructorProfile: true },
  });

  return users
    .map((u) => {
      const p = u.instructorProfile;
      if (!p?.lat || !p?.lng) return null;
      const distanceKm = haversineKm(input.meetLat, input.meetLng, p.lat, p.lng);
      if (distanceKm > RADIUS_KM) return null;
      if (skillLabel && !p.skillLevels.some((s) => s.trim() === skillLabel)) return null;
      if (durationLabel && !p.offeredDurations.some((d) => d.trim() === durationLabel)) return null;
      if (languageNeedle && !p.languages.some((lang) => normalizeText(lang) === languageNeedle))
        return null;
      if (
        requestedDays &&
        !instructorMatchesAvailability(p.availabilitySlots, requestedDays, false)
      ) {
        return null;
      }
      return {
        userId: u.id,
        ratingAvg: p.ratingAvg,
        reviewCount: p.reviewCount,
        distanceKm,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => {
      if (b.ratingAvg !== a.ratingAvg) return b.ratingAvg - a.ratingAvg;
      if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
      return a.distanceKm - b.distanceKm;
    })
    .map((x) => x.userId);
}

/**
 * Назначает следующего онлайн-инструктора из очереди.
 * Очередь циклическая: после последнего снова первый, пока кто-то не примет или все не уйдут офлайн.
 */
export async function assignInstructorByQueue(orderId: string, reason: "initial" | "timeout" | "reject") {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return null;

    const flexibleInvite = order.flexibleInstructorInvite === true;
    const relaxedTiming = orderRelaxedInstructorTiming(order);
    const requireOnline = !flexibleInvite;

    const queue = Array.isArray(order.instructorQueue) ? (order.instructorQueue as string[]) : [];
    if (!queue.length) {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "EXPIRED",
          pendingExpiresAt: null,
        },
      });
      return { status: "EXPIRED" as const };
    }

    const len = queue.length;
    const attemptStart =
      reason === "initial" ? 0 : (order.instructorQueueIndex + 1) % len;

    for (let i = 0; i < len; i++) {
      const idx = (attemptStart + i) % len;
      const nextInstructorId = queue[idx];
      const instr = await tx.user.findFirst({
        where: {
          id: nextInstructorId,
          role: "INSTRUCTOR",
          instructorProfile: {
            verificationStatus: "APPROVED",
            ...(requireOnline ? { isOnline: true } : {}),
          },
        },
        include: { instructorProfile: true },
      });

      if (!instr?.instructorProfile) continue;

      const hourlyRate = Number(instr.instructorProfile.hourlyRate);
      if (!Number.isFinite(hourlyRate) || hourlyRate < 0) continue;

      const totals = computeTotals({
        hourlyRate,
        duration: order.duration,
        platformFeePercent: 15,
      });

      const prepaid =
        order.paymentStatus === "PAID" &&
        order.amountTotal != null &&
        order.instructorShareAmount != null;

      const pendingExpiresAt = relaxedTiming ? null : new Date(Date.now() + RESPONSE_WINDOW_MS);
      const updated = await tx.order.update({
        where: { id: orderId },
        data: prepaid
          ? {
              instructorId: nextInstructorId,
              instructorQueueIndex: idx,
              status: "PENDING_INSTRUCTOR",
              pendingExpiresAt,
            }
          : {
              instructorId: nextInstructorId,
              instructorQueueIndex: idx,
              status: "PENDING_INSTRUCTOR",
              pendingExpiresAt,
              agreedHourlyRate: orderMoneyDecimal(hourlyRate),
              amountTotal: orderMoneyDecimal(totals.total),
              instructorShareAmount: orderMoneyDecimal(totals.instructorShare),
              platformFeePercent: 15,
            },
      });

      const body = await buildNotificationBody(updated, {
        flexibleInvite: updated.flexibleInstructorInvite === true,
        relaxedTiming: orderRelaxedInstructorTiming(updated),
      });
      await tx.message.create({
        data: {
          orderId: order.id,
          senderId: order.clientId,
          body,
        },
      });

      return { status: "PENDING_INSTRUCTOR" as const, order: updated };
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "EXPIRED",
        pendingExpiresAt: null,
      },
    });
    return { status: "EXPIRED" as const };
  });
}

export type PrepareQueueResult =
  | { ok: true }
  | {
      ok: false;
      reason: "ORDER_NOT_FOUND" | "NO_INSTRUCTOR_CHOSEN" | "NO_PROFILE" | "NO_QUEUE";
    };

/**
 * Строит очередь и фиксирует суммы (ставка выбранного инструктора, комиссия платформы 15%).
 * Назначение инструктора из очереди — только после успешной оплаты (см. webhook Stripe).
 */
export async function prepareInstructorQueue(orderId: string): Promise<PrepareQueueResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, reason: "ORDER_NOT_FOUND" };

  const chosenId = order.instructorId;
  if (!chosenId) return { ok: false, reason: "NO_INSTRUCTOR_CHOSEN" };

  const profile = await prisma.instructorProfile.findUnique({
    where: { userId: chosenId },
    select: { hourlyRate: true, verificationStatus: true },
  });
  if (!profile || profile.verificationStatus !== "APPROVED") {
    return { ok: false, reason: "NO_PROFILE" };
  }

  let queue: string[];

  if (order.flexibleInstructorInvite || orderSpansMultipleLessonDays(order)) {
    queue = [chosenId];
  } else {
    queue = await buildInstructorQueueForOrder({
      meetLat: order.meetLat,
      meetLng: order.meetLng,
      languagePref: order.languagePref,
      skillLevel: order.skillLevel,
      duration: order.duration,
      requestedStartDate: order.requestedStartDate,
      requestedEndDate: order.requestedEndDate,
      requestedDays: order.requestedDays,
    });

    const chosenOnline = await prisma.user.findFirst({
      where: {
        id: chosenId,
        role: "INSTRUCTOR",
        instructorProfile: { isOnline: true, verificationStatus: "APPROVED" },
      },
    });
    const rest = queue.filter((id) => id !== chosenId);
    queue = chosenOnline ? [chosenId, ...rest] : rest;
  }

  if (!queue.length) {
    return { ok: false, reason: "NO_QUEUE" };
  }

  const hourlyRate = Number(profile.hourlyRate);
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
    return { ok: false, reason: "NO_PROFILE" };
  }

  const totals = computeTotals({
    hourlyRate,
    duration: order.duration,
    platformFeePercent: 15,
  });

  await prisma.order.update({
    where: { id: orderId },
    data: {
      instructorQueue: queue as Prisma.InputJsonValue,
      instructorQueueIndex: 0,
      agreedHourlyRate: orderMoneyDecimal(hourlyRate),
      amountTotal: orderMoneyDecimal(totals.total),
      instructorShareAmount: orderMoneyDecimal(totals.instructorShare),
      platformFeePercent: 15,
    },
  });

  return { ok: true };
}

/** Cron / фон: все просроченные ожидания ответа инструктора. */
export async function processExpiredPendingOrders(): Promise<number> {
  const now = new Date();
  const expired = await prisma.order.findMany({
    where: {
      status: "PENDING_INSTRUCTOR",
      pendingExpiresAt: { lt: now },
    },
    select: { id: true },
  });
  let count = 0;
  for (const row of expired) {
    await assignInstructorByQueue(row.id, "timeout");
    count += 1;
  }
  return count;
}

/** Перед выдачей заказа — если дедлайн прошёл, передать следующему в очереди. */
export async function rerouteOrderIfDeadlinePassed(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, pendingExpiresAt: true },
  });
  if (
    !order ||
    order.status !== "PENDING_INSTRUCTOR" ||
    !order.pendingExpiresAt ||
    order.pendingExpiresAt >= new Date()
  ) {
    return;
  }
  await assignInstructorByQueue(orderId, "timeout");
}

export async function loadRoutingQueueLabels(queueIds: string[]) {
  if (!queueIds.length) return [] as { userId: string; name: string | null }[];
  const users = await prisma.user.findMany({
    where: { id: { in: queueIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  return queueIds.map((userId) => ({
    userId,
    name: nameById.get(userId) ?? null,
  }));
}
