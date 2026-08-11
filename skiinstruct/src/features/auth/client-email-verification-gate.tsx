"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
 * z-index выше карты Leaflet (~700) и виджетов (~6000).
 */
export function ClientEmailVerificationGate() {
  const { data: session, status: sessionStatus } = useSession();
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const celebrated = useRef(false);
  const product = getPublicProductName();
  const [mounted, setMounted] = useState(false);
  /** Защёлка: показали блок — не прячем, пока API не скажет verified. */
  const [locked, setLocked] = useState(false);

  const justRegistered = searchParams.get("verifyEmail") === "1";
  const justVerified = searchParams.get("emailVerified") === "1";

  const isClient =
    sessionStatus === "authenticated" && session?.user?.role === "CLIENT";

  const status = useQuery({
    queryKey: ["email-verification-status"],
    queryFn: fetchEmailStatus,
    enabled: isClient && !justVerified,
    staleTime: 0,
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d || d.verified) return false;
      return 3_000;
    },
    refetchOnWindowFocus: true,
  });

  useEffect(() => setMounted(true), []);

  // После клика по ссылке в письме — не мигать гейтом
  useEffect(() => {
    if (!justVerified) return;
    celebrated.current = true;
    setLocked(false);
    qc.setQueryData<Status>(["email-verification-status"], (prev) => ({
      email: prev?.email ?? session?.user?.email ?? null,
      verified: true,
      required: true,
      role: "CLIENT",
    }));
    toast.success("Email подтверждён — добро пожаловать!");
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("emailVerified");
    const q = sp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [justVerified, qc, router, pathname, searchParams, session?.user?.email]);

  // После регистрации сразу держим замок
  useEffect(() => {
    if (justRegistered && isClient) setLocked(true);
  }, [justRegistered, isClient]);

  useEffect(() => {
    if (!status.data) return;
    if (status.data.role === "CLIENT" && !status.data.verified && status.data.email) {
      setLocked(true);
    }
    if (status.data.verified) {
      setLocked(false);
      if (!celebrated.current && justRegistered) {
        celebrated.current = true;
        toast.success("Email подтверждён — добро пожаловать!");
      }
    }
  }, [status.data, justRegistered]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && !justVerified) {
        void qc.invalidateQueries({ queryKey: ["email-verification-status"] });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [qc, justVerified]);

  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);

  // Убрать ?verifyEmail=1 из URL, когда уже показываем гейт (чтобы не мешал шарингу)
  useEffect(() => {
    if (!justRegistered || !locked) return;
    const sp = new URLSearchParams(searchParams.toString());
    if (!sp.has("verifyEmail")) return;
    sp.delete("verifyEmail");
    const q = sp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [justRegistered, locked, router, pathname, searchParams]);

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
        setLocked(false);
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
      const fresh = await fetchEmailStatus();
      if (fresh) qc.setQueryData(["email-verification-status"], fresh);
      return fresh;
    },
    onSuccess: (fresh) => {
      if (fresh?.verified) {
        setLocked(false);
        toast.success("Готово — доступ открыт");
        return;
      }
      toast.message("Ещё не подтверждено", {
        description: "Откройте письмо и нажмите «Подтвердить email», затем снова эту кнопку.",
      });
    },
    onError: () => toast.error("Не удалось проверить статус"),
  });

  if (!mounted || !isClient || justVerified || !locked) return null;

  const email = status.data?.email ?? session?.user?.email ?? null;

  const node = (
    <div
      className="fixed inset-0 z-[10050] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
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
            {email ? (
              <>
                Мы отправили письмо на{" "}
                <span className="font-medium text-foreground">{email}</span>. Откройте его и нажмите
                кнопку «Подтвердить email». Пока адрес не подтверждён, заказ и оплата недоступны.
              </>
            ) : (
              <>
                Мы отправили письмо на ваш email. Откройте его и нажмите «Подтвердить email». Пока
                адрес не подтверждён, заказ и оплата недоступны.
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Письма нет? Загляните в «Спам» / «Промоакции». Окно закроется само после подтверждения —
            можно открыть почту в другой вкладке.
          </p>
        </div>

        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
          {status.isFetching || !email
            ? "Проверяем статус…"
            : "Ждём подтверждение… Проверяем автоматически каждые несколько секунд."}
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

  return createPortal(node, document.body);
}
