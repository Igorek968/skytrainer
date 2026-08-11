"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

function homeForRole(role: string | null | undefined): string {
  if (role === "INSTRUCTOR") return "/instructor/pending?emailVerified=1";
  if (role === "ADMIN") return "/admin/metrics?emailVerified=1";
  return "/client?emailVerified=1";
}

function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const j = (await res.json()) as {
          ok?: boolean;
          email?: string;
          role?: string | null;
          error?: string;
        };
        if (!res.ok || !j.ok) {
          setState("error");
          return;
        }
        setEmail(j.email ?? null);
        setRole(j.role ?? null);
        setState("ok");
      })
      .catch(() => setState("error"));
  }, [token]);

  const nextHref = homeForRole(role);

  useEffect(() => {
    if (state !== "ok") return;
    const t = window.setTimeout(() => {
      router.replace(nextHref);
    }, 1800);
    return () => window.clearTimeout(t);
  }, [state, router, nextHref]);

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
                    Email <strong>{email}</strong> подтверждён.
                  </>
                ) : (
                  "Email подтверждён."
                )}{" "}
                {role === "INSTRUCTOR"
                  ? "Блокировка снята — откроем кабинет инструктора."
                  : "Блокировка снята — откроем карту заказов."}
              </p>
              <Button asChild className="w-full">
                <Link href={nextHref}>Перейти сейчас</Link>
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
