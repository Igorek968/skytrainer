"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ADMIN_USER_ROLE_LABELS, type AdminUserRoleFilter } from "@/lib/admin-list-filters";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export type AdminMessageTarget = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

type Props = {
  target: AdminMessageTarget;
  onClose: () => void;
};

export function AdminSendMessageModal({ target, onClose }: Props) {
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: target.id,
          subject: subject.trim() || null,
          body: body.trim(),
        }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        error?: string | { formErrors?: string[] };
        emailSent?: boolean;
      };
      if (!r.ok) {
        const err =
          typeof data.error === "string"
            ? data.error
            : data.error?.formErrors?.[0] || `Ошибка ${r.status}`;
        throw new Error(err);
      }
      return data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["admin-direct-messages"] });
      if (data.emailSent) {
        toast.success(`Сообщение отправлено: чат поддержки + email (${target.email})`);
      } else {
        toast.success("Сообщение отправлено в чат поддержки", {
          description: "Письмо не ушло — проверьте SMTP / Postbox. Push отправится, если включены уведомления.",
        });
      }
      onClose();
    },
    onError: (e: Error) => {
      toast.error(e.message || "Не удалось отправить");
    },
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !mutation.isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, mutation.isPending]);

  const roleLabel =
    ADMIN_USER_ROLE_LABELS[target.role as AdminUserRoleFilter] ?? target.role;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-send-message-title"
      onClick={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="admin-send-message-title" className="text-lg font-semibold">
          Сообщение пользователю
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {target.name?.trim() || "—"} · {target.email} · {roleLabel}
        </p>
        <p className="mt-2 text-sm text-foreground">
          Текст появится в чате поддержки адресата, уйдёт push-уведомлением и дублем на email (если SMTP
          настроен).
        </p>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="admin-msg-subject" className="text-sm">
              Тема <span className="text-muted-foreground">(необязательно)</span>
            </Label>
            <Input
              id="admin-msg-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              placeholder="Например: уточнение по заявке"
              disabled={mutation.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-msg-body" className="text-sm">
              Текст <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="admin-msg-body"
              autoFocus
              className="min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={4000}
              placeholder="Текст сообщения…"
              disabled={mutation.isPending}
            />
            <p className="text-xs text-muted-foreground">{body.trim().length} / 4000</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending || body.trim().length < 1}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Отправка…" : "Отправить и на email"}
          </Button>
        </div>
      </div>
    </div>
  );
}
