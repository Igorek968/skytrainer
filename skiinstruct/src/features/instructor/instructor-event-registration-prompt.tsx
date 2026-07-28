"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { instructorAlertPollInterval } from "@/lib/query-poll";
import { fireSiteAlert, siteAlertTitle } from "@/lib/site-alert";
import { Button } from "@/shared/ui/button";

/** Показывать popup для записей за последние N мс при первом открытии кабинета. */
const RECENT_REGISTRATION_MS = 30 * 60 * 1000;

type RegistrationAlertRow = {
  id: string;
  createdAt: string;
  client: { name: string | null; email: string | null };
  event: { title: string };
};

function isRecentRegistration(row: RegistrationAlertRow): boolean {
  const createdMs = new Date(row.createdAt).getTime();
  return Number.isFinite(createdMs) && Date.now() - createdMs <= RECENT_REGISTRATION_MS;
}

function notifyInstructorAboutRegistration(reg: RegistrationAlertRow) {
  const clientLabel = reg.client.name?.trim() || reg.client.email?.trim() || "Клиент";
  const title = reg.event.title.trim() || "Мероприятие";
  const registrationUrl = `/instructor/registrations/${reg.id}`;
  fireSiteAlert({
    title: siteAlertTitle("новая запись на мероприятие"),
    body: `${clientLabel} · ${title}`,
    sound: "order",
    tag: `event-registration-${reg.id}`,
    url: registrationUrl,
    requireInteraction: true,
    toastAction: {
      label: "Открыть",
      onClick: () => {
        window.location.href = registrationUrl;
      },
    },
  });
}

export function InstructorEventRegistrationPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeAlert, setActiveAlert] = useState<RegistrationAlertRow | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const viewingRegistrationId = pathname?.match(/^\/instructor\/registrations\/([^/]+)/)?.[1] ?? null;

  const { data } = useQuery({
    queryKey: ["instructor-registration-alerts"],
    queryFn: async () => {
      const r = await fetch("/api/instructor/registrations", { credentials: "include" });
      if (!r.ok) throw new Error("registration-alerts");
      return r.json() as Promise<{ registrations: RegistrationAlertRow[] }>;
    },
    refetchInterval: instructorAlertPollInterval(5000),
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const registrations = data?.registrations;
    if (!registrations?.length) return;

    if (!initializedRef.current) {
      initializedRef.current = true;
      const recent = registrations.filter(isRecentRegistration);
      for (const row of registrations) {
        if (!isRecentRegistration(row)) seenIdsRef.current.add(row.id);
      }
      const newestRecent = recent[0] ?? null;
      if (newestRecent && viewingRegistrationId !== newestRecent.id) {
        for (const row of recent) seenIdsRef.current.add(row.id);
        notifyInstructorAboutRegistration(newestRecent);
        setActiveAlert(newestRecent);
      } else {
        for (const row of registrations) seenIdsRef.current.add(row.id);
      }
      return;
    }

    const unseen = registrations.filter((row) => !seenIdsRef.current.has(row.id));
    if (!unseen.length) return;

    const newest = unseen[0]!;
    for (const row of unseen) seenIdsRef.current.add(row.id);

    if (viewingRegistrationId === newest.id) return;

    notifyInstructorAboutRegistration(newest);
    setActiveAlert(newest);
  }, [data?.registrations, viewingRegistrationId]);

  if (!activeAlert) return null;

  const clientLabel = activeAlert.client.name?.trim() || activeAlert.client.email?.trim() || "Клиент";
  const eventTitle = activeAlert.event.title.trim() || "Мероприятие";

  return (
    <div
      className="fixed inset-x-3 bottom-4 z-[9998] mx-auto w-[min(100vw-1.5rem,24rem)] rounded-lg border border-border bg-background p-4 shadow-xl sm:inset-x-auto sm:right-4 sm:left-auto"
      role="alertdialog"
      aria-labelledby="instructor-event-registration-alert-title"
      aria-describedby="instructor-event-registration-alert-body"
    >
      <h2 id="instructor-event-registration-alert-title" className="text-sm font-semibold">
        Новая запись на мероприятие
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{clientLabel}</p>
      <p id="instructor-event-registration-alert-body" className="mt-2 whitespace-pre-wrap text-sm">
        {eventTitle}
      </p>
      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => setActiveAlert(null)}>
          Закрыть
        </Button>
        <Button
          type="button"
          variant="accent"
          size="sm"
          onClick={() => {
            setActiveAlert(null);
            router.push(`/instructor/registrations/${activeAlert.id}`);
          }}
        >
          Открыть заявку
        </Button>
      </div>
    </div>
  );
}
