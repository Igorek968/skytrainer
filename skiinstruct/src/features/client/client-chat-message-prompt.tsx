"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { instructorAlertPollInterval } from "@/lib/query-poll";
import { fireSiteAlert, siteAlertTitle } from "@/lib/site-alert";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

type ChatAlertRow = {
  id: string;
  body: string;
  createdAt: string;
  orderId: string;
  instructorName: string | null;
};

function previewMessage(body: string, max = 200): string {
  const compact = body.replace(/\s+/g, " ").trim();
  if (!compact) return "(пустое сообщение)";
  return compact.length > max ? `${compact.slice(0, max).trim()}…` : compact;
}

function alertClientChatMessage(alert: ChatAlertRow) {
  const instructorLabel = alert.instructorName?.trim() || "Инструктор";
  const preview = previewMessage(alert.body, 120);
  const orderUrl = `/client/orders/${alert.orderId}#order-chat`;

  fireSiteAlert({
    title: siteAlertTitle("сообщение от инструктора"),
    body: `${instructorLabel}: ${preview}`,
    sound: "chat",
    tag: `client-chat-${alert.id}`,
    url: orderUrl,
    toastAction: {
      label: "Открыть чат",
      onClick: () => {
        window.location.href = orderUrl;
      },
    },
  });
}

/** Оповещение клиенту о новом сообщении инструктора + быстрый ответ. */
export function ClientChatMessagePrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const [activeAlert, setActiveAlert] = useState<ChatAlertRow | null>(null);
  const [replyText, setReplyText] = useState("");
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const viewingOrderId = pathname?.match(/^\/client\/orders\/([^/]+)/)?.[1] ?? null;

  const { data } = useQuery({
    queryKey: ["client-chat-alerts"],
    queryFn: async () => {
      const r = await fetch("/api/client/chat-alerts", { credentials: "include" });
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

    alertClientChatMessage(newestNew);
    setActiveAlert(newestNew);
    setReplyText("");
  }, [data?.messages, viewingOrderId]);

  const sendReply = useMutation({
    mutationFn: async (payload: { orderId: string; body: string }) => {
      const r = await fetch(`/api/orders/${payload.orderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: payload.body }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: unknown };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Не удалось отправить");
    },
    onSuccess: async () => {
      toast.success("Ответ отправлен");
      setActiveAlert(null);
      setReplyText("");
      await qc.invalidateQueries({ queryKey: ["client-chat-alerts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!activeAlert) return null;

  const instructorLabel = activeAlert.instructorName?.trim() || "Инструктор";

  return (
    <div
      className="fixed bottom-4 right-4 z-[9998] w-[min(100vw-1.5rem,24rem)] rounded-lg border border-border bg-background p-4 shadow-xl"
      role="alertdialog"
      aria-labelledby="client-chat-alert-title"
      aria-describedby="client-chat-alert-body"
    >
      <h2 id="client-chat-alert-title" className="text-sm font-semibold">
        Сообщение от инструктора
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{instructorLabel}</p>
      <p id="client-chat-alert-body" className="mt-2 whitespace-pre-wrap text-sm">
        {previewMessage(activeAlert.body, 500)}
      </p>
      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const body = replyText.trim();
          if (!body) return;
          sendReply.mutate({ orderId: activeAlert.orderId, body });
        }}
      >
        <Input
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Быстрый ответ…"
          aria-label="Быстрый ответ инструктору"
          disabled={sendReply.isPending}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setActiveAlert(null)}
            disabled={sendReply.isPending}
          >
            Закрыть
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveAlert(null);
              router.push(`/client/orders/${activeAlert.orderId}#order-chat`);
            }}
          >
            Открыть чат
          </Button>
          <Button type="submit" variant="accent" size="sm" disabled={sendReply.isPending || !replyText.trim()}>
            Отправить
          </Button>
        </div>
      </form>
    </div>
  );
}
