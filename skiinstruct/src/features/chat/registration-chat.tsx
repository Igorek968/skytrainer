"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PaidContactCallButton } from "@/features/chat/paid-contact-call";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { devPollInterval } from "@/lib/query-poll";

type Msg = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string | null; image: string | null };
};

export function RegistrationChat({
  registrationId,
  contactUrl,
  callLabel,
}: {
  registrationId: string;
  contactUrl: string;
  callLabel: string;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["registration-messages", registrationId],
    queryFn: async () => {
      const r = await fetch(`/api/registrations/${registrationId}/messages`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("messages");
      return r.json() as Promise<{ messages: Msg[] }>;
    },
    staleTime: 8000,
    refetchInterval: devPollInterval(10_000),
    refetchIntervalInBackground: false,
  });

  const send = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/registrations/${registrationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: text }),
      });
      if (!r.ok) throw new Error("send");
      return r.json();
    },
    onSuccess: async () => {
      setText("");
      await qc.invalidateQueries({ queryKey: ["registration-messages", registrationId] });
    },
    onError: () => toast.error("Не удалось отправить"),
  });

  return (
    <div id="registration-chat" className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm font-medium">Связь по событию</div>
        <PaidContactCallButton contactUrl={contactUrl} label={callLabel} />
      </div>
      <div
        className="max-h-72 space-y-2 overflow-y-auto rounded-md bg-muted/40 p-3"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : error ? (
          <p className="text-sm text-destructive">Ошибка загрузки чата</p>
        ) : !data?.messages.length ? (
          <p className="text-sm text-muted-foreground">
            Напишите, чтобы согласовать место встречи. Или нажмите «Позвонить».
          </p>
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
          maxLength={2000}
          disabled={send.isPending}
        />
        <Button type="submit" variant="accent" disabled={send.isPending || !text.trim()}>
          Отправить
        </Button>
      </form>
    </div>
  );
}
