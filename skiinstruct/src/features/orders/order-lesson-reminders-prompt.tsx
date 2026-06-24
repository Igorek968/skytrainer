"use client";

import type { LessonDuration } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { instructorAlertPollInterval } from "@/lib/query-poll";
import {
  isInLessonEndReminderWindow,
  isInLessonStartNowWindow,
  isInOneHourReminderWindow,
} from "@/lib/order-lesson-reminder-windows";
import { markReminderShown, wasReminderShown } from "@/lib/reminder-seen-storage";
import { fireSiteAlert, siteAlertTitle } from "@/lib/site-alert";
import { orderRelaxedInstructorTiming } from "@/shared/lib/order-flex";
import { Button } from "@/shared/ui/button";

type OrderReminderRow = {
  id: string;
  status: string;
  requestedStartDate: string | null;
  lessonStartedAt: string | null;
  duration: string;
  flexibleInstructorInvite?: boolean;
  requestedDays?: number | null;
  client?: { name: string | null } | null;
  instructor?: { name: string | null } | null;
};

type ReminderKind = "one_hour" | "start_now" | "end_lesson";

type ActiveReminder = {
  kind: ReminderKind;
  order: OrderReminderRow;
};

function orderUrl(role: "instructor" | "client", orderId: string): string {
  return role === "instructor" ? `/instructor/orders/${orderId}` : `/client/orders/${orderId}`;
}

function formatStartLabel(requestedStartDate: string | null): string {
  if (!requestedStartDate) return "—";
  return new Date(requestedStartDate).toLocaleString("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function isRelaxedLesson(o: OrderReminderRow): boolean {
  return orderRelaxedInstructorTiming({
    flexibleInstructorInvite: Boolean(o.flexibleInstructorInvite),
    requestedDays: o.requestedDays ?? null,
    requestedStartDate: o.requestedStartDate,
  });
}

function alertReminder(
  role: "instructor" | "client",
  kind: ReminderKind,
  order: OrderReminderRow,
): void {
  const url = orderUrl(role, order.id);
  const startLabel = formatStartLabel(order.requestedStartDate);
  const counterparty =
    role === "instructor"
      ? order.client?.name?.trim() || "Клиент"
      : order.instructor?.name?.trim() || "Инструктор";

  if (kind === "one_hour") {
    fireSiteAlert({
      title: siteAlertTitle("скоро начало урока"),
      body: `Через ~1 час занятие с ${counterparty} (${startLabel}).`,
      sound: "reminder",
      tag: `lesson-1h-${order.id}`,
      url,
      toastAction: { label: "Открыть заказ", onClick: () => { window.location.href = url; } },
    });
    return;
  }

  if (kind === "start_now") {
    fireSiteAlert({
      title: siteAlertTitle("пора начать тренировку"),
      body:
        role === "instructor"
          ? `Время занятия с ${counterparty} (${startLabel}). Откройте заказ и нажмите «Начать урок».`
          : `Наступило время занятия с ${counterparty} (${startLabel}).`,
      sound: "reminder",
      tag: `lesson-start-${order.id}`,
      url,
      requireInteraction: true,
      toastAction: { label: "Открыть заказ", onClick: () => { window.location.href = url; } },
    });
    return;
  }

  fireSiteAlert({
    title: siteAlertTitle("завершите сделку"),
    body:
      role === "instructor"
        ? "Урок по расписанию окончен. Нажмите «Завершить урок» — так фиксируется оплата и статус."
        : "Урок по расписанию окончен. Попросите инструктора завершить урок в приложении или дождитесь подтверждения.",
    sound: "reminder",
    tag: `lesson-end-${order.id}`,
    url,
    requireInteraction: true,
    toastAction: { label: "Открыть заказ", onClick: () => { window.location.href = url; } },
  });
}

/**
 * In-app оповещения по уроку: за ~1 ч, в момент старта, по окончании (PWA/Android, сайт открыт).
 */
export function OrderLessonRemindersPrompt({ role }: { role: "instructor" | "client" }) {
  const router = useRouter();
  const [active, setActive] = useState<ActiveReminder | null>(null);

  const { data } = useQuery({
    queryKey: role === "instructor" ? ["instructor-order-alerts"] : ["client-order-reminders"],
    queryFn: async () => {
      const r = await fetch("/api/orders", { credentials: "include" });
      if (!r.ok) throw new Error("orders-reminders");
      return r.json() as Promise<{ orders: OrderReminderRow[] }>;
    },
    refetchInterval: instructorAlertPollInterval(5000),
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const orders = data?.orders;
    if (!orders?.length) return;

    const now = Date.now();
    let hit: { kind: ReminderKind; order: OrderReminderRow; tag: string } | null = null;

    for (const order of orders) {
      if (isRelaxedLesson(order)) continue;

      if (
        (order.status === "PENDING_INSTRUCTOR" ||
          order.status === "ACCEPTED" ||
          order.status === "INSTRUCTOR_EN_ROUTE") &&
        order.requestedStartDate &&
        isInOneHourReminderWindow(order.requestedStartDate, now)
      ) {
        const tag = `lesson-1h-${order.id}`;
        if (!wasReminderShown(tag)) {
          hit = { kind: "one_hour", order, tag };
          break;
        }
      }

      if (
        (order.status === "ACCEPTED" || order.status === "INSTRUCTOR_EN_ROUTE") &&
        order.requestedStartDate &&
        isInLessonStartNowWindow(order.requestedStartDate, now)
      ) {
        const tag = `lesson-start-${order.id}`;
        if (!wasReminderShown(tag)) {
          hit = { kind: "start_now", order, tag };
          break;
        }
      }

      if (
        order.status === "LESSON_STARTED" &&
        order.lessonStartedAt &&
        isInLessonEndReminderWindow(order.lessonStartedAt, order.duration as LessonDuration, now)
      ) {
        const tag = `lesson-end-${order.id}`;
        if (!wasReminderShown(tag)) {
          hit = { kind: "end_lesson", order, tag };
          break;
        }
      }
    }

    if (!hit) return;

    markReminderShown(hit.tag);
    alertReminder(role, hit.kind, hit.order);
    setActive({ kind: hit.kind, order: hit.order });
  }, [data?.orders, role]);

  if (!active) return null;

  const { kind, order } = active;
  const url = orderUrl(role, order.id);
  const counterparty =
    role === "instructor"
      ? order.client?.name?.trim() || "Клиент"
      : order.instructor?.name?.trim() || "Инструктор";
  const startLabel = formatStartLabel(order.requestedStartDate);

  const title =
    kind === "one_hour"
      ? "Скоро начало урока"
      : kind === "start_now"
        ? "Пора начать тренировку"
        : "Завершите сделку";

  const body =
    kind === "one_hour"
      ? `Через ~1 час занятие с ${counterparty} (${startLabel}).`
      : kind === "start_now"
        ? role === "instructor"
          ? `Время занятия с ${counterparty}. Нажмите «Начать урок» в заказе.`
          : `Наступило время занятия с ${counterparty} (${startLabel}).`
        : role === "instructor"
          ? "Урок по расписанию окончен. Нажмите «Завершить урок» в заказе."
          : "Урок по расписанию окончен. Дождитесь завершения сделки инструктором.";

  return (
    <div
      className="fixed inset-0 z-[9997] flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="lesson-reminder-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-background p-4 shadow-xl">
        <h2 id="lesson-reminder-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setActive(null)}>
            Позже
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={() => {
              setActive(null);
              router.push(url);
            }}
          >
            Открыть заказ
          </Button>
        </div>
      </div>
    </div>
  );
}
