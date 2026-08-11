"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const j = (await res.json()) as { ok?: boolean; email?: string; error?: string };
        if (!res.ok || !j.ok) {
          setState("error");
          return;
        }
        setEmail(j.email ?? null);
        setState("ok");
      })
      .catch(() => setState("error"));
  }, [token]);

  useEffect(() => {
    if (state !== "ok") return;
    const t = window.setTimeout(() => {
      router.replace("/client");
    }, 2500);
    return () => window.clearTimeout(t);
  }, [state, router]);

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
                Блокировка снята — через пару секунд откроем карту заказов со всеми функциями.
              </p>
              <Button asChild className="w-full">
                <Link href="/client">Перейти сейчас</Link>
              </Button>
            </>
          ) : state === "error" ? (
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/login">Войти и запросить письмо снова</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/client">На главную</Link>
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
