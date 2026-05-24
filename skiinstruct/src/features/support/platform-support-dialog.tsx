"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LEGAL_ROUTES } from "@/lib/legal";
import { devPollInterval } from "@/lib/query-poll";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

type SupportMessage = {
  id: string;
  authorRole: "USER" | "STAFF" | "SYSTEM";
  body: string;
  createdAt: string;
};

type SupportTicket = {
  id: string;
  shortId: string;
  status: string;
  messages: SupportMessage[];
};

type SupportPayload = {
  ticket: SupportTicket | null;
  telegramConfigured: boolean;
  telegramUrl: string | null;
  supportEmail: string | null;
};

function roleLabel(role: SupportMessage["authorRole"]): string {
  if (role === "STAFF") return "Поддержка";
  if (role === "SYSTEM") return "Система";
  return "Вы";
}

export function PlatformSupportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const loggedIn = Boolean(session?.user);

  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [text, setText] = useState("");
  const [started, setStarted] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["support-ticket"],
    enabled: open,
    queryFn: async () => {
      const r = await fetch("/api/support/ticket", { credentials: "include", cache: "no-store" });
      if (!r.ok) throw new Error("support");
      return r.json() as Promise<SupportPayload>;
    },
    refetchInterval: open ? devPollInterval(5000) : false,
    staleTime: 0,
  });

  useEffect(() => {
    if (!open) {
      setStarted(false);
      setText("");
    }
  }, [open]);

  useEffect(() => {
    if (data?.ticket) setStarted(true);
  }, [data?.ticket]);

  const startChat = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/support/ticket", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestEmail: loggedIn ? undefined : guestEmail.trim(),
          guestName: loggedIn ? undefined : guestName.trim() || undefined,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as SupportPayload & { error?: string };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Не удалось открыть чат");
      return j;
    },
    onSuccess: async (j) => {
      setStarted(true);
      await qc.setQueryData(["support-ticket"], j);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: async (body: string) => {
      const r = await fetch("/api/support/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "send");
    },
    onSuccess: async () => {
      setText("");
      await refetch();
    },
    onError: () => toast.error("Не удалось отправить"),
  });

  const ticket = data?.ticket;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(90dvh,calc(100vh-2rem))] gap-0 p-0"
        aria-labelledby="platform-support-title"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="shrink-0 border-b border-border px-5 py-4">
          <h2 id="platform-support-title" className="text-lg font-semibold tracking-tight">
            Поддержка платформы
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Опишите проблему с заказом, оплатой или аккаунтом. Это не чат с инструктором — для занятия используйте чат в
            карточке заказа.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {!started && !ticket ? (
            <div className="space-y-3 text-sm">
              {!loggedIn ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="sup-email">Email для ответа</Label>
                    <Input
                      id="sup-email"
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sup-name">Имя (необязательно)</Label>
                    <Input id="sup-name" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Вы вошли как <span className="font-medium text-foreground">{session?.user?.email}</span>.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Отправляя сообщение, вы соглашаетесь с{" "}
                <Link href={LEGAL_ROUTES.privacy} className="text-accent underline" target="_blank">
                  политикой ПДн
                </Link>
                .
              </p>
            </div>
          ) : (
            <>
              {ticket ? (
                <p className="text-xs text-muted-foreground">
                  Обращение #{ticket.shortId}
                  {data?.telegramConfigured
                    ? " · сообщения дублируются в Telegram оператору"
                    : " · Telegram не настроен на сервере — ответ придёт здесь"}
                </p>
              ) : null}
              <div
                className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border bg-muted/30 p-3"
                role="log"
                aria-live="polite"
              >
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Загрузка…</p>
                ) : !ticket?.messages.length ? (
                  <p className="text-sm text-muted-foreground">Напишите первое сообщение ниже.</p>
                ) : (
                  ticket.messages.map((m) => (
                    <div
                      key={m.id}
                      className={
                        m.authorRole === "USER"
                          ? "ml-4 rounded-md bg-accent/15 px-2 py-1.5 text-sm"
                          : "mr-4 rounded-md bg-muted px-2 py-1.5 text-sm"
                      }
                    >
                      <p className="text-xs font-medium text-muted-foreground">{roleLabel(m.authorRole)}</p>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {(data?.telegramUrl || data?.supportEmail) && (
            <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              Также:{" "}
              {data.telegramUrl ? (
                <a className="text-accent underline" href={data.telegramUrl} target="_blank" rel="noreferrer">
                  Telegram
                </a>
              ) : null}
              {data.telegramUrl && data.supportEmail ? " · " : null}
              {data.supportEmail ? (
                <a className="text-accent underline" href={`mailto:${data.supportEmail}`}>
                  {data.supportEmail}
                </a>
              ) : null}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-5 py-4">
          {!started && !ticket ? (
            <Button
              type="button"
              variant="accent"
              className="w-full"
              disabled={startChat.isPending || (!loggedIn && !guestEmail.trim())}
              onClick={() => startChat.mutate()}
            >
              {startChat.isPending ? "Открываем…" : "Начать диалог"}
            </Button>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const t = text.trim();
                if (!t) return;
                if (!ticket) {
                  startChat.mutate(undefined, {
                    onSuccess: () => send.mutate(t),
                  });
                  return;
                }
                send.mutate(t);
              }}
            >
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Опишите проблему…"
                disabled={send.isPending}
                aria-label="Сообщение в поддержку"
              />
              <Button type="submit" variant="accent" disabled={send.isPending || !text.trim()}>
                Отправить
              </Button>
            </form>
          )}
          <Button type="button" variant="ghost" className="mt-2 w-full" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
