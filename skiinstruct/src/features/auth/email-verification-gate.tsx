"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { getPublicProductName } from "@/shared/lib/product";
import { RUSSIAN_EMAIL_EXAMPLES, RUSSIAN_EMAIL_HINT } from "@/lib/russian-email";
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
 * После регистрации (?verifyEmail=1 / sessionStorage) показывается сразу, не дожидаясь сессии.
 */
export function EmailVerificationGate({ role }: { role: GateRole }) {
  const { data: session, status: sessionStatus, update: updateSession } = useSession();
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const celebrated = useRef(false);
  const product = getPublicProductName();
  const [mounted, setMounted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const copy = copyForRole(role);

  const justRegistered = searchParams.get("verifyEmail") === "1";
  const justVerified = searchParams.get("emailVerified") === "1";
  const forceFlag = mounted && isEmailVerificationGateForced();
  const forceShow = justRegistered || forceFlag;

  const isTargetRole =
    sessionStatus === "authenticated" && session?.user?.role === role;

  const status = useQuery({
    queryKey: ["email-verification-status"],
    queryFn: fetchEmailStatus,
    enabled: (isTargetRole || forceShow) && !justVerified && sessionStatus !== "unauthenticated",
    staleTime: 0,
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d || d.verified) return false;
      return 3_000;
    },
    refetchOnWindowFocus: true,
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || justVerified) return;
    if (justRegistered || isEmailVerificationGateForced()) {
      forceEmailVerificationGate();
      setLocked(true);
    }
  }, [mounted, justVerified, justRegistered]);

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
    sp.delete("verifyEmail");
    const q = sp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [justVerified, qc, router, pathname, searchParams, session?.user?.email, role, copy.unlocked]);

  useEffect(() => {
    if (!status.data) return;
    if (status.data.role && status.data.role !== role) return;

    const unverified = !status.data.verified && Boolean(status.data.email);
    const needsVerify =
      unverified &&
      (role === "INSTRUCTOR" ||
        status.data.required ||
        justRegistered ||
        isEmailVerificationGateForced());

    if (needsVerify) {
      forceEmailVerificationGate();
      setLocked(true);
      return;
    }

    if (status.data.verified) {
      const wasForced = justRegistered || isEmailVerificationGateForced();
      setLocked(false);
      clearForcedEmailVerificationGate();
      if (!celebrated.current && wasForced) {
        celebrated.current = true;
        toast.success(copy.unlocked);
      }
      if (justRegistered) {
        const sp = new URLSearchParams(searchParams.toString());
        if (sp.has("verifyEmail")) {
          sp.delete("verifyEmail");
          const q = sp.toString();
          router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
        }
      }
    }
  }, [status.data, justRegistered, role, copy.unlocked, router, pathname, searchParams]);

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

  const changeEmail = useMutation({
    mutationFn: async (email: string) => {
      const r = await fetch("/api/auth/change-unverified-email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        email?: string;
        warning?: string;
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? "Не удалось сменить email");
      return j;
    },
    onSuccess: async (j) => {
      const email = j.email ?? newEmail.trim().toLowerCase();
      qc.setQueryData<Status>(["email-verification-status"], (prev) => ({
        email,
        verified: false,
        required: prev?.required ?? true,
        role: prev?.role ?? role,
      }));
      await updateSession({ email }).catch(() => undefined);
      void qc.invalidateQueries({ queryKey: ["email-verification-status"] });
      setChangeOpen(false);
      setNewEmail("");
      if (j.warning) {
        toast.message("Email обновлён", { description: j.warning });
      } else {
        toast.success("Email обновлён — письмо отправлено на новый адрес");
      }
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

  const allowRender =
    locked &&
    !justVerified &&
    (isTargetRole || forceShow) &&
    sessionStatus !== "unauthenticated";

  if (!mounted || !allowRender) return null;

  const email = status.data?.email ?? session?.user?.email ?? null;
  const authReady = sessionStatus === "authenticated";

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

        {changeOpen ? (
          <form
            className="space-y-3 rounded-lg border border-border bg-muted/30 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const value = newEmail.trim();
              if (!value.includes("@")) {
                toast.error("Укажите корректный email");
                return;
              }
              changeEmail.mutate(value);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="change-email-input">Новый email</Label>
              <Input
                id="change-email-input"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder={role === "INSTRUCTOR" ? "name@mail.ru" : "name@example.com"}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={changeEmail.isPending}
                required
              />
              {role === "INSTRUCTOR" ? (
                <p className="text-xs text-muted-foreground">
                  {RUSSIAN_EMAIL_HINT} {RUSSIAN_EMAIL_EXAMPLES}.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  На новый адрес сразу уйдёт письмо со ссылкой подтверждения.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="submit"
                className="w-full sm:flex-1"
                disabled={changeEmail.isPending || !authReady}
              >
                {changeEmail.isPending ? "Сохраняем…" : "Сохранить и выслать письмо"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full sm:w-auto"
                disabled={changeEmail.isPending}
                onClick={() => {
                  setChangeOpen(false);
                  setNewEmail("");
                }}
              >
                Отмена
              </Button>
            </div>
          </form>
        ) : null}

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
            disabled={resend.isPending || !authReady}
            onClick={() => resend.mutate()}
          >
            {resend.isPending ? "Отправляем…" : "Выслать письмо ещё раз"}
          </Button>
          {!changeOpen ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={!authReady}
              onClick={() => {
                setNewEmail(email ?? "");
                setChangeOpen(true);
              }}
            >
              Сменить почту
            </Button>
          ) : null}
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
