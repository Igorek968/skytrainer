import { NextResponse } from "next/server";

import type { LessonDuration, OrderStatus, SkillLevel } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertClientHasNoOtherActiveOrder } from "@/lib/services/client-active-order";
import { prepareInstructorQueue, processExpiredPendingOrders } from "@/lib/services/instructor-routing";
import { createOrderSchema } from "@/lib/validations/order";

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

function parseWallDateTime(ymd: string, hm: string): Date | null {
  const y = ymd.trim();
  const t = hm.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(y) || !/^\d{2}:\d{2}$/.test(t)) return null;
  const d = new Date(`${y}T${t}:00`);
  return Number.isFinite(d.getTime()) ? d : null;
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
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await processExpiredPendingOrders();

  const uid = session.user.id;
  let role = session.user.role;
  if (!role) {
    const row = await prisma.user.findUnique({
      where: { id: uid },
      select: { role: true },
    });
    role = row?.role;
  }

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
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let role = session.user.role;
  if (!role) {
    const row = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    role = row?.role;
  }
  if (role !== "CLIENT") {
    return NextResponse.json(
      { error: "Создавать заказы могут только клиенты. Войдите под учётной записью клиента." },
      { status: 403 },
    );
  }

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
    skillLevel,
    languagePref,
    duration,
    notes,
    lessonDate,
    lessonEndDate,
    lessonDays,
    resortId,
    instructorId,
    flexibleInstructorInvite,
    lessonStartTime: lessonStartTimeRaw,
    lessonEndTime: lessonEndTimeRaw,
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

  let requestedStartDate: Date | null = null;
  let requestedEndDate: Date | null = null;
  if (lessonDate) {
    const endYmd = lessonEndDate ?? lessonDate;
    const startDt = parseWallDateTime(lessonDate, lessonStartTime);
    const endDt = parseWallDateTime(endYmd, lessonEndTime);
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
    await assertClientHasNoOtherActiveOrder(session.user.id);
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
      { status: 400 }
    );
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

  const notesFinal =
    notesWithLessonDate != null && String(notesWithLessonDate).trim() !== ""
      ? String(notesWithLessonDate)
      : null;

  const createData = dropUndefined({
    clientId: session.user.id,
    instructorId: instructorId ?? null,
    status: (instructorId ? "AWAITING_PAYMENT" : "DRAFT") as OrderStatus,
    meetLat: meetLatN,
    meetLng: meetLngN,
    skillLevel: skillLevel as SkillLevel,
    languagePref: languagePref.trim(),
    duration: duration as LessonDuration,
    notes: notesFinal,
    requestedDays: Math.trunc(requestedDaysSafe),
    ...scheduleFields,
    resortId: resortId ?? undefined,
    flexibleInstructorInvite: Boolean(flexibleInstructorInvite && instructorId),
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
            : flexibleInstructorInvite
              ? "Не удалось подготовить заявку к выбранному инструктору"
              : "Нет доступных онлайн-инструкторов для этой заявки";
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
