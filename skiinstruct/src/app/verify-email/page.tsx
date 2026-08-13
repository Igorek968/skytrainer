"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { readClientCheckoutDraft } from "@/lib/client-checkout-draft";
import { CLIENT_BOOKING_RETURN_PATH, readPendingCheckout } from "@/lib/client-pending-checkout";
import { clearForcedEmailVerificationGate } from "@/lib/email-gate-force";

function fallbackHomeForRole(role: string | null | undefined, redirectTo: string | null): string {
  if (redirectTo?.trim()) return redirectTo.trim();
  if (role === "INSTRUCTOR") return "/instructor/pending?emailVerified=1";
  if (role === "ADMIN" || role === "MODERATOR") return "/admin/metrics?emailVerified=1";
  const resumeOrder = Boolean(readPendingCheckout() || readClientCheckoutDraft());
  if (resumeOrder) return `${CLIENT_BOOKING_RETURN_PATH}&emailVerified=1`;
  return "/client?emailVerified=1";
}

function successMessage(role: string | null, nextHref: string): string {
  if (role === "INSTRUCTOR") {
    if (nextHref.includes("/instructor/login")) {
      return "Войдите — откроется ожидание модерации или кабинет.";
    }
    if (nextHref.includes("/instructor/pending")) {
      return "Открываем экран ожидания модерации.";
    }
    return "Открываем кабинет инструктора.";
  }
  if (nextHref.includes("checkout=1")) {
    return "Вернёмся к оформлению заказа.";
  }
  if (nextHref.includes("/login")) {
    return "Войдите — откроется кабинет клиента.";
  }
  return "Открываем кабинет клиента.";
}

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [nextHref, setNextHref] = useState("/client?emailVerified=1");

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const j = (await res.json()) as {
          ok?: boolean;
          email?: string;
          role?: string | null;
          loginToken?: string;
          redirectTo?: string;
          error?: string;
        };
        if (!res.ok || !j.ok) {
          if (!cancelled) setState("error");
          return;
        }

        let redirectTo = fallbackHomeForRole(j.role, j.redirectTo ?? null);

        if (j.loginToken) {
          const sessionRes = await fetch("/api/auth/email-verification/session", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ loginToken: j.loginToken, email: j.email }),
          });
          const sessionJson = (await sessionRes.json().catch(() => ({}))) as {
            ok?: boolean;
            redirectTo?: string;
          };
          if (sessionRes.ok && sessionJson.redirectTo) {
            redirectTo = sessionJson.redirectTo;
          } else if (!sessionRes.ok && j.role === "INSTRUCTOR") {
            redirectTo = `/instructor/login?emailVerified=1&email=${encodeURIComponent(j.email ?? "")}&callbackUrl=${encodeURIComponent(redirectTo)}`;
          } else if (!sessionRes.ok && j.role === "CLIENT") {
            redirectTo = `/login?emailVerified=1&email=${encodeURIComponent(j.email ?? "")}&callbackUrl=${encodeURIComponent(redirectTo)}`;
          }
        }

        // После session API снова проверяем черновик заказа — иначе redirectTo сбрасывается в /client.
        if (j.role === "CLIENT") {
          const resumeOrder = Boolean(readPendingCheckout() || readClientCheckoutDraft());
          if (resumeOrder) redirectTo = `${CLIENT_BOOKING_RETURN_PATH}&emailVerified=1`;
        }

        if (cancelled) return;
        clearForcedEmailVerificationGate();
        setEmail(j.email ?? null);
        setRole(j.role ?? null);
        setNextHref(redirectTo);
        setState("ok");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (state !== "ok") return;
    // Не уводим автоматически на форму логина — только в кабинет / pending
    if (nextHref.includes("/login") || nextHref.includes("/instructor/login")) return;
    // Полная перезагрузка: cookie сессии успевает примениться (router.replace часто кидал на login)
    const t = window.setTimeout(() => {
      window.location.assign(nextHref);
    }, 900);
    return () => window.clearTimeout(t);
  }, [state, nextHref]);

  return (
    <div className="mx-auto max-w-md py-10">
      <Card>
        <CardHeader>
          <CardTitle>Подтверждение email</CardTitle>
          <CardDescription>
            {state === "loading"
              ? "Проверяем ссылку…"
              : state === "ok"
                ? "Адрес почты подтверждён."
                : "Ссылка недействительна или устарела. Запросите новое письмо при входе."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "ok" ? (
            <>
              <p className="text-sm text-muted-foreground">
                {email ? (
                  <>
                    Email <strong>{email}</strong> подтверждён.{" "}
                  </>
                ) : (
                  "Email подтверждён. "
                )}
                {successMessage(role, nextHref)}
              </p>
              <Button
                className="w-full"
                type="button"
                onClick={() => {
                  window.location.assign(nextHref);
                }}
              >
                Перейти сейчас
              </Button>
            </>
          ) : state === "error" ? (
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/login">Вход клиента</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/instructor/login">Вход инструктора</Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Загрузка…</div>}>
      <VerifyEmailInner />
    </Suspense>
  );
}
