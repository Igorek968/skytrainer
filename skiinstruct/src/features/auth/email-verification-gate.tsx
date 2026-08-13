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
import {
  clearForcedEmailVerificationGate,
  forceEmailVerificationGate,
  isEmailVerificationGateForced,
} from "@/lib/email-gate-force";

type Status = {
  email: string | null;
  verified: boolean;
  required: boolean;
  role?: string;
};

type GateRole = "CLIENT" | "INSTRUCTOR";

export { forceEmailVerificationGate, clearForcedEmailVerificationGate };

async function fetchEmailStatus(): Promise<Status | null> {
  const r = await fetch("/api/auth/email-verification", {
    credentials: "include",
    cache: "no-store",
  });
  if (r.status === 401) return null;
  if (!r.ok) throw new Error("status");
  return r.json() as Promise<Status>;
}

function copyForRole(role: GateRole) {
  if (role === "INSTRUCTOR") {
    return {
      title: "Остался один шаг — подтвердите email",
      body: (email: string | null) =>
        email ? (
          <>
            Мы отправили письмо на{" "}
            <span className="font-medium text-foreground">{email}</span>. Откройте его и нажмите
            «Подтвердить email». Пока адрес не подтверждён, кабинет и выход на линию недоступны.
          </>
        ) : (
          <>
            Мы отправили письмо на ваш email. Откройте его и нажмите «Подтвердить email». Пока адрес
            не подтверждён, кабинет и выход на линию недоступны.
          </>
        ),
      hint: "Письма нет? Загляните в «Спам». Окно закроется само после подтверждения — можно открыть почту в другой вкладке.",
      unlocked: "Email подтверждён — теперь дождитесь решения модератора",
    };
  }
  return {
    title: "Остался один шаг — подтвердите email",
    body: (email: string | null) =>
      email ? (
        <>
          Мы отправили письмо на{" "}
          <span className="font-medium text-foreground">{email}</span>. Откройте его и нажмите
          кнопку «Подтвердить email». Пока адрес не подтверждён, заказ и оплата недоступны.
        </>
      ) : (
        <>
          Мы отправили письмо на ваш email. Откройте его и нажмите «Подтвердить email». Пока адрес не
          подтверждён, заказ и оплата недоступны.
        </>
      ),
    hint: "Письма нет? Загляните в «Спам» / «Промоакции». Окно закроется само после подтверждения — можно открыть почту в другой вкладке.",
    unlocked: "Email подтверждён — добро пожаловать!",
  };
}

/**
 * Жёсткий экран: сайт/кабинет недоступны, пока email не подтверждён.
 * z-index выше карты Leaflet и плавающих виджетов.
 */
export function EmailVerificationGate({ role }: { role: GateRole }) {
  const { data: session, status: sessionStatus } = useSession();
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const celebrated = useRef(false);
  const product = getPublicProductName();
  const [mounted, setMounted] = useState(false);
  const [locked, setLocked] = useState(false);
  const copy = copyForRole(role);

  const justRegistered = searchParams.get("verifyEmail") === "1";
  const justVerified = searchParams.get("emailVerified") === "1";

  const isTargetRole =
    sessionStatus === "authenticated" && session?.user?.role === role;

  const status = useQuery({
    queryKey: ["email-verification-status"],
    queryFn: fetchEmailStatus,
    enabled: isTargetRole && !justVerified,
    staleTime: 0,
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d || d.verified) return false;
      return 3_000;
    },
    refetchOnWindowFocus: true,
  });

  useEffect(() => setMounted(true), []);

  // Регистрация из окна заказа / без ?verifyEmail= — сразу замок
  useEffect(() => {
    if (!mounted || !isTargetRole || justVerified) return;
    if (isEmailVerificationGateForced() || justRegistered) {
      setLocked(true);
    }
  }, [mounted, isTargetRole, justVerified, justRegistered]);

  useEffect(() => {
    if (!justVerified) return;
    celebrated.current = true;
    setLocked(false);
    clearForcedEmailVerificationGate();
    qc.setQueryData<Status>(["email-verification-status"], (prev) => ({
      email: prev?.email ?? session?.user?.email ?? null,
      verified: true,
      required: true,
      role,
    }));
    toast.success(copy.unlocked);
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("emailVerified");
    const q = sp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [justVerified, qc, router, pathname, searchParams, session?.user?.email, role, copy.unlocked]);

  useEffect(() => {
    if (justRegistered && isTargetRole) {
      forceEmailVerificationGate();
      setLocked(true);
    }
  }, [justRegistered, isTargetRole]);

  useEffect(() => {
    if (!status.data) return;
    const needsVerify =
      status.data.role === role &&
      !status.data.verified &&
      Boolean(status.data.email) &&
      (status.data.required || justRegistered || isEmailVerificationGateForced());
    if (needsVerify) {
      forceEmailVerificationGate();
      setLocked(true);
    }
    if (status.data.verified) {
      const wasForced = justRegistered || isEmailVerificationGateForced();
      setLocked(false);
      clearForcedEmailVerificationGate();
      if (!celebrated.current && wasForced) {
        celebrated.current = true;
        toast.success(copy.unlocked);
      }
    }
  }, [status.data, justRegistered, role, copy.unlocked]);

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
        clearForcedEmailVerificationGate();
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
        clearForcedEmailVerificationGate();
        toast.success("Готово — доступ открыт");
        return;
      }
      toast.message("Ещё не подтверждено", {
        description: "Откройте письмо и нажмите «Подтвердить email», затем снова эту кнопку.",
      });
    },
    onError: () => toast.error("Не удалось проверить статус"),
  });

  if (!mounted || !isTargetRole || justVerified || !locked) return null;

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
            {copy.title}
          </h2>
          <p id="email-gate-desc" className="text-sm leading-relaxed text-muted-foreground">
            {copy.body(email)}
          </p>
          <p className="text-xs text-muted-foreground">{copy.hint}</p>
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

/** @deprecated используйте EmailVerificationGate role="CLIENT" */
export function ClientEmailVerificationGate() {
  return <EmailVerificationGate role="CLIENT" />;
}
