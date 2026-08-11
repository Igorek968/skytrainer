"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { getPublicProductName } from "@/shared/lib/product";
import { cn } from "@/lib/utils";

type Status = {
  email: string | null;
  verified: boolean;
  required: boolean;
  role?: string;
};

async function fetchEmailStatus(): Promise<Status | null> {
  const r = await fetch("/api/auth/email-verification", {
    credentials: "include",
    cache: "no-store",
  });
  if (r.status === 401) return null;
  if (!r.ok) throw new Error("status");
  return r.json() as Promise<Status>;
}

/**
 * Жёсткий экран для клиента: сайт недоступен, пока email не подтверждён.
 * Поллит статус; после клика по ссылке в письме окно само снимается.
 */
export function ClientEmailVerificationGate() {
  const { data: session, status: sessionStatus } = useSession();
  const qc = useQueryClient();
  const celebrated = useRef(false);
  const product = getPublicProductName();

  const isClient =
    sessionStatus === "authenticated" && session?.user?.role === "CLIENT";

  const status = useQuery({
    queryKey: ["email-verification-status"],
    queryFn: fetchEmailStatus,
    enabled: isClient,
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d || d.verified) return false;
      return 4_000;
    },
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void qc.invalidateQueries({ queryKey: ["email-verification-status"] });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [qc]);

  useEffect(() => {
    if (!status.data?.verified || celebrated.current) return;
    celebrated.current = true;
    toast.success("Email подтверждён — добро пожаловать!");
  }, [status.data?.verified]);

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
        void qc.invalidateQueries({ queryKey: ["email-verification-status"] });
        toast.success("Email уже подтверждён");
        return;
      }
      toast.success("Письмо отправлено — проверьте входящие и «Спам»");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkNow = useMutation({
    mutationFn: async () => {
      await qc.invalidateQueries({ queryKey: ["email-verification-status"] });
      const fresh = await fetchEmailStatus();
      return fresh;
    },
    onSuccess: (fresh) => {
      if (fresh?.verified) {
        toast.success("Готово — доступ открыт");
        return;
      }
      toast.message("Ещё не подтверждено", {
        description: "Откройте письмо и нажмите ссылку, затем снова «Я подтвердил».",
      });
    },
    onError: () => toast.error("Не удалось проверить статус"),
  });

  if (!isClient) return null;
  if (status.isLoading || status.isPending) return null;
  if (!status.data || status.data.verified || !status.data.email) return null;

  const email = status.data.email;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="email-gate-title"
      aria-describedby="email-gate-desc"
    >
      <div
        className={cn(
          "flex w-full max-w-md flex-col gap-4 rounded-t-2xl border border-border bg-background p-5 shadow-2xl sm:rounded-2xl sm:p-6",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {product}
          </p>
          <h2 id="email-gate-title" className="text-xl font-semibold tracking-tight text-foreground">
            Остался один шаг — подтвердите email
          </h2>
          <p id="email-gate-desc" className="text-sm leading-relaxed text-muted-foreground">
            Мы отправили письмо на{" "}
            <span className="font-medium text-foreground">{email}</span>. Откройте его и нажмите
            кнопку «Подтвердить email». Пока адрес не подтверждён, заказ и оплата недоступны — так
            мы защищаем ваш аккаунт и платежи.
          </p>
          <p className="text-xs text-muted-foreground">
            Письма нет? Загляните в «Спам» / «Промоакции». Можно выслать ссылку ещё раз — окно само
            закроется, как только подтверждение пройдёт.
          </p>
        </div>

        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
          Ждём подтверждение… Можно открыть почту в другой вкладке — мы проверяем статус каждые
          несколько секунд.
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="w-full"
            disabled={checkNow.isPending}
            onClick={() => checkNow.mutate()}
          >
            {checkNow.isPending ? "Проверяем…" : "Я подтвердил — открыть доступ"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={resend.isPending}
            onClick={() => resend.mutate()}
          >
            {resend.isPending ? "Отправляем…" : "Выслать письмо ещё раз"}
          </Button>
        </div>
      </div>
    </div>
  );
}
