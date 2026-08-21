"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { instructorAlertPollInterval } from "@/lib/query-poll";
import { isInOneHourReminderWindow } from "@/lib/order-lesson-reminder-windows";
import { markReminderShown, wasReminderShown } from "@/lib/reminder-seen-storage";
import { fireSiteAlert, siteAlertTitle } from "@/lib/site-alert";

type ClientRegRow = {
  id: string;
  status: string;
  startsAt: string | null;
  event: { id: string; title: string };
  instructor: { name: string | null };
};

type InstructorStartRow = {
  key: string;
  eventId: string;
  slotId: string | null;
  title: string;
  startsAt: string;
};

function formatStartLabel(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * In-app оповещение за ~1 час до события (клиент или инструктор, сайт открыт).
 */
export function EventStartRemindersPrompt({ role }: { role: "client" | "instructor" }) {
  const { data: clientData } = useQuery({
    queryKey: ["client-event-start-reminders"],
    queryFn: async () => {
      const r = await fetch("/api/client/registrations", { credentials: "include" });
      if (!r.ok) throw new Error("registrations");
      return r.json() as Promise<{ registrations: ClientRegRow[] }>;
    },
    enabled: role === "client",
    refetchInterval: instructorAlertPollInterval(5000),
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const { data: instructorData } = useQuery({
    queryKey: ["instructor-event-start-reminders"],
    queryFn: async () => {
      const r = await fetch("/api/instructor/upcoming-event-starts", { credentials: "include" });
      if (!r.ok) throw new Error("event-starts");
      return r.json() as Promise<{ items: InstructorStartRow[] }>;
    },
    enabled: role === "instructor",
    refetchInterval: instructorAlertPollInterval(5000),
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (role !== "client") return;
    const regs = clientData?.registrations ?? [];
    for (const reg of regs) {
      if (reg.status !== "PAID" && reg.status !== "PENDING_PAYMENT") continue;
      if (!reg.startsAt || !isInOneHourReminderWindow(reg.startsAt)) continue;
      const tag = `event-1h-client-${reg.id}`;
      if (wasReminderShown(tag)) continue;
      markReminderShown(tag);
      const url = `/client/registrations/${reg.id}`;
      const who = reg.instructor.name?.trim() || "инструктор";
      fireSiteAlert({
        title: siteAlertTitle("скоро событие"),
        body: `Через ~1 час «${reg.event.title}» с ${who} (${formatStartLabel(reg.startsAt)}).`,
        sound: "reminder",
        tag,
        url,
        toastAction: {
          label: "Открыть запись",
          onClick: () => {
            window.location.href = url;
          },
        },
      });
      break;
    }
  }, [role, clientData]);

  useEffect(() => {
    if (role !== "instructor") return;
    const items = instructorData?.items ?? [];
    for (const item of items) {
      if (!isInOneHourReminderWindow(item.startsAt)) continue;
      const tag = `event-1h-inst-${item.key}`;
      if (wasReminderShown(tag)) continue;
      markReminderShown(tag);
      const url = "/instructor#events";
      fireSiteAlert({
        title: siteAlertTitle("скоро ваше событие"),
        body: `Через ~1 час начало «${item.title}» (${formatStartLabel(item.startsAt)}).`,
        sound: "reminder",
        tag,
        url,
        toastAction: {
          label: "К событиям",
          onClick: () => {
            window.location.href = url;
          },
        },
      });
      break;
    }
  }, [role, instructorData]);

  return null;
}
