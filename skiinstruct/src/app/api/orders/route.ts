import { NextResponse } from "next/server";

import type { LessonDuration, OrderStatus, SkillLevel, UserRole } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { isApiErrorResponse, requireAuthSession, requireClientSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { assertClientHasNoOtherActiveOrder } from "@/lib/services/client-active-order";
import { findInstructorScheduleConflict } from "@/lib/services/instructor-schedule";
import { prepareInstructorQueue, processExpiredPendingOrders } from "@/lib/services/instructor-routing";
import { canonicalizeActivityLabel } from "@/lib/services/instructor-match";
import { createOrderSchema } from "@/lib/validations/order";
import { mergeMeetAddressToNotes } from "@/shared/lib/order-meet-address";
import { inferLessonDurationFromBillableHours } from "@/shared/lib/order-duration";
import { parseWallDateTime } from "@/shared/lib/lesson-wall-datetime";
import { resolveBillableHours } from "@/shared/lib/order-billing-hours";
import { orderIsTodayLessonDay } from "@/shared/lib/order-flex";

/** Счёт календарных дней по YYYY-MM-DD в UTC полдень (без сдвига из‑за DST у полуночи). */
function calendarSpanDaysInclusive(startIso: string, endIso: string): number {
  const parseUtcNoon = (s: string): number | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
    if (!m) return null;
    const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    return Number.isFinite(t) ? t : null;
  };
  const t0 = parseUtcNoon(startIso);
  const t1 = parseUtcNoon(endIso);
  if (t0 == null || t1 == null) return 1;
  const span = Math.floor((t1 - t0) / 86_400_000) + 1;
  return Math.min(30, Math.max(1, span));
}

/** Prisma strictUndefinedChecks / сериализация: явный `undefined` в `data` иногда даёт PrismaClientValidationError. */
function dropUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function safeCoord(n: unknown, min: number, max: number): number | null {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.min(max, Math.max(min, x));
}

export async function GET() {
  const resolved = await requireAuthSession();
  if (isApiErrorResponse(resolved)) return resolved;

  await processExpiredPendingOrders();

  const uid = resolved.userId;
  const role = resolved.role;

  const where =
    role === "CLIENT"
      ? { clientId: uid }
      : role === "INSTRUCTOR"
        ? { instructorId: uid, status: { not: "AWAITING_PAYMENT" as const } }
        : role === "ADMIN"
          ? {}
          : { id: "___none___" };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true, image: true } },
      instructor: { select: { id: true, name: true, image: true } },
      resort: true,
    },
    take: 100,
  });

  return NextResponse.json({ orders });
}

export async function POST(req: Request) {
  const resolved = await requireClientSession();
  if (isApiErrorResponse(resolved)) return resolved;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(json);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const fieldMessages = Object.values(flat.fieldErrors).flat().filter(Boolean) as string[];
    const issueMessages = parsed.error.issues.map((i) => i.message).filter(Boolean);
    const message =
      fieldMessages[0] ??
      flat.formErrors[0] ??
      issueMessages[0] ??
      parsed.error.message ??
      "Некорректные данные заказа";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const {
    meetLat,
    meetLng,
    meetAddress: meetAddressRaw,
    skillLevel,
    languagePref,
    duration,
    notes,
    disciplineLabel: disciplineLabelRaw,
    lessonDate,
    lessonEndDate,
    lessonDays,
    resortId,
    instructorId,
    flexibleInstructorInvite,
    urgentInvite,
    lessonStartTime: lessonStartTimeRaw,
    lessonEndTime: lessonEndTimeRaw,
    lessonTimeZoneOffsetMinutes,
  } =
    parsed.data;

  const lessonStartTime = lessonStartTimeRaw ?? "10:00";
  const lessonEndTime = lessonEndTimeRaw ?? "12:00";

  const calculatedLessonDays =
    lessonDate && lessonEndDate
      ? calendarSpanDaysInclusive(lessonDate, lessonEndDate)
      : lessonDays;

  const requestedDaysSafe = (() => {
    const raw = calculatedLessonDays;
    if (raw == null || !Number.isFinite(raw)) return 1;
    const n = Math.trunc(raw);
    return Math.min(30, Math.max(1, n));
  })();

  const tzOffset = Number.isFinite(lessonTimeZoneOffsetMinutes)
    ? Number(lessonTimeZoneOffsetMinutes)
    : 0;

  let requestedStartDate: Date | null = null;
  let requestedEndDate: Date | null = null;
  if (lessonDate) {
    const endYmd = lessonEndDate ?? lessonDate;
    const startDt = parseWallDateTime(lessonDate, lessonStartTime, tzOffset);
    const endDt = parseWallDateTime(endYmd, lessonEndTime, tzOffset);
    if (!startDt || !endDt) {
      return NextResponse.json({ error: "Некорректная дата или время урока." }, { status: 400 });
    }
    requestedStartDate = startDt;
    requestedEndDate = endDt;
  }

  const scheduleLines: string[] = [];
  if (lessonDate) {
    scheduleLines.push(
      `Желаемые даты урока: ${lessonDate}${lessonEndDate ? ` - ${lessonEndDate}` : ""}${requestedDaysSafe > 1 ? ` (${requestedDaysSafe} дн.)` : ""}`,
    );
    scheduleLines.push(
      `Время: с ${lessonStartTime} (день начала) до ${lessonEndTime} (день окончания)`,
    );
  } else if (requestedDaysSafe > 1) {
    scheduleLines.push(`Желаемая длительность курса: ${requestedDaysSafe} дн.`);
  }
  const orderScheduleLine = scheduleLines.length ? scheduleLines.join("\n") : null;
  const notesWithLessonDate = orderScheduleLine
    ? `${orderScheduleLine}${notes?.trim() ? `\n${notes.trim()}` : ""}`
    : notes;

  try {
    await assertClientHasNoOtherActiveOrder(resolved.userId);
  } catch (e) {
    if (e instanceof Error && e.message === "ACTIVE_ORDER_EXISTS") {
      return NextResponse.json(
        {
          error:
            "У вас уже есть активная заявка. Завершите или отмените её перед созданием новой.",
        },
        { status: 409 }
      );
    }
    throw e;
  }

  if (flexibleInstructorInvite && !instructorId) {
    return NextResponse.json(
      { error: "Для записи на дату нужно выбрать инструктора." },
      { status: 400 },
    );
  }

  if (urgentInvite) {
    if (!instructorId) {
      return NextResponse.json(
        { error: "Для срочной заявки выберите инструктора из списка «на линии»." },
        { status: 400 },
      );
    }
    if (flexibleInstructorInvite) {
      return NextResponse.json(
        { error: "Режим «Срочно» несовместим с записью на дату." },
        { status: 400 },
      );
    }
    if (requestedStartDate && !orderIsTodayLessonDay({ requestedStartDate })) {
      return NextResponse.json(
        { error: "Срочная заявка доступна только на сегодня." },
        { status: 400 },
      );
    }
  }

  const billableHours =
    requestedStartDate && requestedEndDate
      ? resolveBillableHours({
          duration: duration as LessonDuration,
          requestedStartDate,
          requestedEndDate,
          notes: notesWithLessonDate,
        })
      : null;
  const durationForOrder =
    billableHours != null
      ? (inferLessonDurationFromBillableHours(billableHours) ?? (duration as LessonDuration))
      : (duration as LessonDuration);

  if (instructorId && lessonDate) {
    const conflict = await findInstructorScheduleConflict({
      instructorId,
      lessonDate,
      lessonEndDate: lessonEndDate ?? lessonDate,
      lessonStartTime,
      lessonEndTime,
      duration: durationForOrder,
      lessonTimeZoneOffsetMinutes: tzOffset,
    });
    if (conflict) {
      return NextResponse.json({ error: conflict.message, code: "SCHEDULE_CONFLICT" }, { status: 409 });
    }
  }

  const meetLatN = safeCoord(meetLat, -90, 90);
  const meetLngN = safeCoord(meetLng, -180, 180);
  if (meetLatN == null || meetLngN == null) {
    return NextResponse.json(
      { error: "Некорректные координаты точки встречи. Обновите страницу или перетащите маркер на карте." },
      { status: 400 },
    );
  }

  const scheduleFields = lessonDate
    ? {
        requestedStartDate,
        requestedEndDate,
      }
    : {};

  const meetAddress = meetAddressRaw.trim();
  const notesWithMeet = mergeMeetAddressToNotes(notesWithLessonDate, meetAddress);
  const notesFinal =
    notesWithMeet != null && String(notesWithMeet).trim() !== ""
      ? String(notesWithMeet)
      : null;

  const createData = dropUndefined({
    clientId: resolved.userId,
    instructorId: instructorId ?? null,
    status: (instructorId ? "AWAITING_PAYMENT" : "DRAFT") as OrderStatus,
    meetLat: meetLatN,
    meetLng: meetLngN,
    meetAddress,
    skillLevel: skillLevel as SkillLevel,
    languagePref: languagePref.trim(),
    duration: durationForOrder,
    notes: notesFinal,
    disciplineLabel: disciplineLabelRaw?.trim()
      ? canonicalizeActivityLabel(disciplineLabelRaw.trim()) || undefined
      : undefined,
    requestedDays: Math.trunc(requestedDaysSafe),
    ...scheduleFields,
    resortId: resortId ?? undefined,
    flexibleInstructorInvite: Boolean(flexibleInstructorInvite && instructorId),
    urgentInvite: Boolean(urgentInvite && instructorId),
  }) as Prisma.OrderUncheckedCreateInput;

  try {
    const order = await prisma.order.create({
      data: createData,
    });

    if (instructorId) {
      const prepared = await prepareInstructorQueue(order.id);
      if (!prepared.ok) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: "EXPIRED",
            pendingExpiresAt: null,
            instructorQueue: Prisma.JsonNull,
            instructorQueueIndex: 0,
            agreedHourlyRate: null,
            amountTotal: null,
            instructorShareAmount: null,
          },
        });
        const msg =
          prepared.reason === "NO_PROFILE"
            ? "Выбранный инструктор недоступен для записи"
            : "Не удалось подготовить заявку к выбранному инструктору";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      const refreshed = await prisma.order.findUnique({
        where: { id: order.id },
        include: {
          client: { select: { id: true, name: true, image: true } },
          instructor: { select: { id: true, name: true, image: true } },
          resort: true,
        },
      });
      return NextResponse.json({ order: refreshed });
    }

    return NextResponse.json({ order });
  } catch (e) {
    console.error("[POST /api/orders]", e);
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2003") {
        return NextResponse.json(
          {
            error:
              "Не удалось связать заказ с инструктором или курортом. Обновите список инструкторов и попробуйте снова.",
          },
          { status: 400 },
        );
      }
      if (e.code === "P2022" || e.code === "P2021") {
        return NextResponse.json(
          {
            error:
              "База данных не совпадает с версией приложения. На сервере выполните: npx prisma db push (или migrate).",
          },
          { status: 503 },
        );
      }
    }
    if (e instanceof Error && e.name === "PrismaClientValidationError") {
      // Не обрезать только начало: Prisma сначала выводит весь `data`, а суть («Unknown argument», «Invalid value») — в конце.
      const oneLine = e.message.replace(/\s+/g, " ").trim();
      const body =
        oneLine.length > 900 ? `…${oneLine.slice(-850)}` : oneLine;
      return NextResponse.json(
        {
          error: `Ошибка данных заказа (Prisma): ${body}`,
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Ошибка при сохранении заказа. Попробуйте ещё раз или напишите в поддержку." },
      { status: 500 },
    );
  }
}
