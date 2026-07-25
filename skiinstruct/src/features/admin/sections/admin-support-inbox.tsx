"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { formatInAppTimeZone } from "@/shared/lib/app-timezone";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/lib/utils";
import { devPollInterval } from "@/lib/query-poll";

type TicketListItem = {
  id: string;
  shortId: string;
  status: string;
  label: string;
  userId: string | null;
  guestEmail: string | null;
  messageCount: number;
  lastMessage: {
    id: string;
    body: string;
    authorRole: string;
    createdAt: string;
  } | null;
  updatedAt: string;
};

type TicketDetail = {
  id: string;
  shortId: string;
  status: string;
  label: string;
  userId: string | null;
  user: { id: string; name: string | null; email: string; role: string; phone: string | null } | null;
  guestEmail: string | null;
  guestName: string | null;
  messages: {
    id: string;
    body: string;
    authorRole: string;
    createdAt: string;
  }[];
};

export function AdminSupportInboxSection() {
  const qc = useQueryClient();
  const router = useRouter();
  const params = useSearchParams();
  const ticketFromUrl = params.get("ticket")?.trim() || null;

  const [status, setStatus] = useState<"OPEN" | "CLOSED" | "all">("OPEN");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(ticketFromUrl);
  const [reply, setReply] = useState("");

  useEffect(() => {
    if (ticketFromUrl) setSelectedId(ticketFromUrl);
  }, [ticketFromUrl]);

  const listQuery = useQuery({
    queryKey: ["admin-support-tickets", status, q],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (status !== "OPEN") sp.set("status", status);
      if (q.trim()) sp.set("q", q.trim());
      const r = await fetch(`/api/admin/support?${sp}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`support-${r.status}`);
      return r.json() as Promise<{
        tickets: TicketListItem[];
        counts: { open: number; closed: number; all: number };
      }>;
    },
    staleTime: 5_000,
    refetchInterval: devPollInterval(15_000),
  });

  const detailQuery = useQuery({
    queryKey: ["admin-support-ticket", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const r = await fetch(`/api/admin/support/${selectedId}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`ticket-${r.status}`);
      return r.json() as Promise<{ ticket: TicketDetail }>;
    },
    refetchInterval: selectedId ? devPollInterval(10_000) : false,
  });

  const action = useMutation({
    mutationFn: async (body: { action: "reply" | "close" | "reopen"; body?: string }) => {
      if (!selectedId) throw new Error("Нет тикета");
      const r = await fetch(`/api/admin/support/${selectedId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Ошибка");
      return j;
    },
    onSuccess: async (_r, vars) => {
      if (vars.action === "reply") {
        setReply("");
        toast.success("Ответ отправлен");
      } else if (vars.action === "close") toast.success("Тикет закрыт");
      else toast.success("Тикет открыт");
      await qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      await qc.invalidateQueries({ queryKey: ["admin-support-ticket", selectedId] });
      await qc.invalidateQueries({ queryKey: ["admin-alert-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tickets = listQuery.data?.tickets ?? [];
  const ticket = detailQuery.data?.ticket;

  function selectTicket(id: string) {
    setSelectedId(id);
    const sp = new URLSearchParams(params.toString());
    sp.set("ticket", id);
    router.replace(`/admin/messages?${sp.toString()}`);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Card>
        <CardHeader className="space-y-3">
          <div>
            <CardTitle className="text-base">Входящие в поддержку</CardTitle>
            <CardDescription>Тикеты пользователей и гостей. Ответ уходит в чат и push.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["OPEN", `Открытые (${listQuery.data?.counts.open ?? "…"})`],
                ["CLOSED", `Закрытые (${listQuery.data?.counts.closed ?? "…"})`],
                ["all", "Все"],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={status === key ? "secondary" : "outline"}
                onClick={() => setStatus(key)}
              >
                {label}
              </Button>
            ))}
          </div>
          <Input
            placeholder="Поиск: email, имя, id…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </CardHeader>
        <CardContent className="space-y-2">
          {listQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : listQuery.error ? (
            <p className="text-sm text-destructive">Не удалось загрузить тикеты.</p>
          ) : !tickets.length ? (
            <p className="text-sm text-muted-foreground">Нет тикетов в этой выборке.</p>
          ) : (
            <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => selectTicket(t.id)}
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      selectedId === t.id
                        ? "border-accent bg-accent/10"
                        : "border-border hover:bg-muted/40",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t.label}</span>
                      <Badge variant="outline" className="text-[10px]">
                        #{t.shortId}
                      </Badge>
                      <Badge
                        variant={t.status === "OPEN" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {t.status === "OPEN" ? "Открыт" : "Закрыт"}
                      </Badge>
                    </div>
                    {t.lastMessage ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {t.lastMessage.authorRole === "STAFF" ? "Вы: " : ""}
                        {t.lastMessage.body}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatInAppTimeZone(t.updatedAt)} · сообщ.: {t.messageCount}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {ticket ? `${ticket.label} · #${ticket.shortId}` : "Переписка"}
          </CardTitle>
          <CardDescription>
            {ticket?.user?.email || ticket?.guestEmail || "Выберите тикет слева"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedId ? (
            <p className="text-sm text-muted-foreground">Выберите обращение из списка.</p>
          ) : detailQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !ticket ? (
            <p className="text-sm text-destructive">Тикет не найден.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {ticket.status === "OPEN" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ action: "close" })}
                  >
                    Закрыть
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ action: "reopen" })}
                  >
                    Открыть снова
                  </Button>
                )}
              </div>
              <ul className="max-h-[22rem] space-y-2 overflow-y-auto rounded-md border border-border/80 p-2">
                {ticket.messages.map((m) => (
                  <li
                    key={m.id}
                    className={cn(
                      "rounded-md px-2.5 py-2 text-sm",
                      m.authorRole === "STAFF"
                        ? "ml-6 bg-accent/15"
                        : "mr-6 bg-muted/50",
                    )}
                  >
                    <div className="text-[11px] text-muted-foreground">
                      {m.authorRole === "STAFF"
                        ? "Поддержка"
                        : m.authorRole === "SYSTEM"
                          ? "Система"
                          : "Пользователь"}{" "}
                      · {formatInAppTimeZone(m.createdAt)}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                  </li>
                ))}
              </ul>
              <div className="space-y-2">
                <textarea
                  className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Ответ пользователю…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  maxLength={4000}
                />
                <Button
                  type="button"
                  variant="accent"
                  disabled={action.isPending || !reply.trim()}
                  onClick={() => action.mutate({ action: "reply", body: reply.trim() })}
                >
                  Отправить ответ
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
