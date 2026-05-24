"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { devPollInterval } from "@/lib/query-poll";
import { Input } from "@/shared/ui/input";

type Msg = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string | null; image: string | null };
};

export function OrderChat({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["order-messages", orderId],
    queryFn: async () => {
      const r = await fetch(`/api/orders/${orderId}/messages`);
      if (!r.ok) throw new Error("messages");
      return r.json() as Promise<{ messages: Msg[] }>;
    },
    staleTime: 8000,
    refetchInterval: devPollInterval(10000),
    refetchIntervalInBackground: false,
  });

  const send = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/orders/${orderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (!r.ok) throw new Error("send");
      return r.json();
    },
    onSuccess: async () => {
      setText("");
      await qc.invalidateQueries({ queryKey: ["order-messages", orderId] });
    },
    onError: () => toast.error("Не удалось отправить"),
  });

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="text-sm font-medium">Чат</div>
      <div
        className="max-h-72 space-y-2 overflow-y-auto rounded-md bg-muted/40 p-3"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : error ? (
          <p className="text-sm text-destructive">Ошибка загрузки</p>
        ) : !data?.messages.length ? (
          <p className="text-sm text-muted-foreground">Пока нет сообщений</p>
        ) : (
          data.messages.map((m) => (
            <div key={m.id} className="text-sm">
              <span className="font-medium">{m.sender.name ?? "Участник"}:</span>{" "}
              <span className="whitespace-pre-wrap">{m.body}</span>
            </div>
          ))
        )}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          send.mutate();
        }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Сообщение…"
          aria-label="Текст сообщения"
        />
        <Button type="submit" disabled={send.isPending}>
          Отправить
        </Button>
      </form>
    </div>
  );
}
