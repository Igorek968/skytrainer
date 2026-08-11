"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";

type Status = {
  email: string | null;
  verified: boolean;
  required: boolean;
  role?: string;
};

/**
 * Баннер «подтвердите email» для клиента и инструктора.
 * Показывается, пока emailVerified пустой.
 */
export function EmailVerificationBanner({ className }: { className?: string }) {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["email-verification-status"],
    queryFn: async (): Promise<Status | null> => {
      const r = await fetch("/api/auth/email-verification", {
        credentials: "include",
        cache: "no-store",
      });
      if (r.status === 401) return null;
      if (!r.ok) throw new Error("status");
      return r.json() as Promise<Status>;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const resend = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/auth/resend-verification", {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        alreadyVerified?: boolean;
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? "Не удалось отправить письмо");
      return j;
    },
    onSuccess: (j) => {
      if (j.alreadyVerified) {
        toast.success("Email уже подтверждён");
        void qc.invalidateQueries({ queryKey: ["email-verification-status"] });
        return;
      }
      toast.success("Письмо отправлено — проверьте почту и папку «Спам»");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = status.data;
  if (!data || data.verified || !data.email) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100",
        className,
      )}
      role="status"
    >
      <p className="font-medium">Подтвердите email</p>
      <p className="mt-0.5 text-xs opacity-90">
        На <span className="font-medium">{data.email}</span> отправлена ссылка.{" "}
        {data.required
          ? "Без подтверждения недоступны оплата (клиент) и выход на линию (инструктор)."
          : "Подтверждение нужно для безопасности аккаунта."}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-2 h-8 border-amber-600/40 bg-background/60 text-xs"
        disabled={resend.isPending}
        onClick={() => resend.mutate()}
      >
        {resend.isPending ? "Отправляем…" : "Выслать письмо ещё раз"}
      </Button>
    </div>
  );
}
