"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { instructorAlertPollInterval } from "@/lib/query-poll";
import { fireSiteAlert, siteAlertTitle } from "@/lib/site-alert";
import { Button } from "@/shared/ui/button";

type ChatAlertRow = {
  id: string;
  body: string;
  createdAt: string;
  orderId: string;
  clientName: string | null;
};

function previewMessage(body: string, max = 200): string {
  const compact = body.replace(/\s+/g, " ").trim();
  if (!compact) return "(пустое сообщение)";
  return compact.length > max ? `${compact.slice(0, max).trim()}…` : compact;
}

function alertInstructorChatMessage(alert: ChatAlertRow) {
  const clientLabel = alert.clientName?.trim() || "Клиент";
  const preview = previewMessage(alert.body, 120);
  const orderUrl = `/instructor/orders/${alert.orderId}`;

  fireSiteAlert({
    title: siteAlertTitle("сообщение от клиента"),
    body: `${clientLabel}: ${preview}`,
    sound: "chat",
    tag: `instructor-chat-${alert.id}`,
    url: orderUrl,
    toastAction: {
      label: "Открыть чат",
      onClick: () => {
        window.location.href = orderUrl;
      },
    },
  });
}

/**
 * Звук, вибрация и уведомление при новом сообщении клиента в чате заказа.
 */
export function InstructorChatMessagePrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeAlert, setActiveAlert] = useState<ChatAlertRow | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const viewingOrderId = pathname?.match(/^\/instructor\/orders\/([^/]+)/)?.[1] ?? null;

  const { data } = useQuery({
    queryKey: ["instructor-chat-alerts"],
    queryFn: async () => {
      const r = await fetch("/api/instructor/chat-alerts", { credentials: "include" });
      if (!r.ok) throw new Error("chat-alerts");
      return r.json() as Promise<{ messages: ChatAlertRow[] }>;
    },
    refetchInterval: instructorAlertPollInterval(5000),
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const messages = data?.messages;
    if (!messages?.length) return;

    if (!initializedRef.current) {
      initializedRef.current = true;
      for (const m of messages) seenIdsRef.current.add(m.id);
      return;
    }

    const unseen = messages.filter((m) => !seenIdsRef.current.has(m.id));
    if (!unseen.length) return;

    const newestNew = unseen[0]!;
    for (const m of unseen) seenIdsRef.current.add(m.id);

    if (viewingOrderId === newestNew.orderId) return;

    alertInstructorChatMessage(newestNew);
    setActiveAlert(newestNew);
  }, [data?.messages, viewingOrderId]);

  if (!activeAlert) return null;

  const clientLabel = activeAlert.clientName?.trim() || "Клиент";

  return (
    <div
      className="fixed bottom-4 right-4 z-[9998] w-[min(100vw-1.5rem,24rem)] rounded-lg border border-border bg-background p-4 shadow-xl"
      role="alertdialog"
      aria-labelledby="instructor-chat-alert-title"
      aria-describedby="instructor-chat-alert-body"
    >
      <h2 id="instructor-chat-alert-title" className="text-sm font-semibold">
        Сообщение от клиента
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{clientLabel}</p>
      <p id="instructor-chat-alert-body" className="mt-2 whitespace-pre-wrap text-sm">
        {previewMessage(activeAlert.body, 500)}
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
            router.push(`/instructor/orders/${activeAlert.orderId}`);
          }}
        >
          Открыть чат
        </Button>
      </div>
    </div>
  );
}
