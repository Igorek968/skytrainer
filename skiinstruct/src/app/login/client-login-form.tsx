"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type FormEvent } from "react";

import { validateClientLoginEmail } from "@/app/actions/credentials-sign-in";
import { SocialSignInButtons } from "@/shared/auth/social-sign-in-buttons";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { PasswordInput } from "@/shared/ui/password-input";
import { Label } from "@/shared/ui/label";

function LoginFormInner() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl")?.trim() || "/client";
  const authError = params.get("error");
  const returningToOrder = callbackUrl.includes("checkout=1");
  const registered = params.get("registered") === "1";
  const prefilledEmail = params.get("email")?.trim() ?? "";

  const registerHref = useMemo(
    () => `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`,
    [callbackUrl],
  );

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = e.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim();
    const password = String(new FormData(form).get("password") ?? "");

    if (!email || !password) {
      setError("Введите email и пароль");
      setPending(false);
      return;
    }

    const roleCheck = await validateClientLoginEmail(email);
    if (roleCheck.error) {
      setError(roleCheck.error);
      setPending(false);
      return;
    }

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(
          result.error === "Configuration"
            ? "Сбой настройки входа. Откройте сайт по адресу http://localhost:3001 и перезапустите контейнер."
            : "Неверный email или пароль.",
        );
        setPending(false);
        return;
      }

      if (result?.ok === false) {
        setError("Неверный email или пароль.");
        setPending(false);
        return;
      }

      // Полная перезагрузка — сессия и шапка подхватываются надёжно (не только client-side state).
      window.location.assign(callbackUrl);
    } catch {
      setError("Не удалось выполнить вход. Попробуйте ещё раз.");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Card>
        <CardHeader>
          <CardTitle as="h1">Вход клиента</CardTitle>
          {returningToOrder ? (
            <CardDescription>
              После входа вы вернётесь к оформлению заказа с выбранным инструктором. Используйте аккаунт клиента, не
              администратора и не инструктора.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {registered ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Регистрация прошла успешно. Войдите с тем же email и паролем.
            </p>
          ) : null}
          {authError === "Configuration" ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Ошибка настройки входа на сервере. Откройте сайт по тому же адресу, что в AUTH_URL (например
              http://localhost:3001), перезапустите контейнер skiinstruct.
            </p>
          ) : null}

          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={prefilledEmail}
                required
                disabled={pending}
                aria-invalid={Boolean(error)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                required
                disabled={pending}
                aria-invalid={Boolean(error)}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link className="text-sm text-accent underline" href={registerHref}>
                Создать аккаунт
              </Link>
              <Link
                className="text-sm text-muted-foreground underline decoration-muted-foreground/40 hover:decoration-muted-foreground"
                href="/reset-password"
              >
                Забыли пароль?
              </Link>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button className="w-full" type="submit" disabled={pending} aria-busy={pending}>
              {pending ? "Вход…" : "Войти"}
            </Button>
          </form>

          <SocialSignInButtons callbackUrl={callbackUrl} />

          <p className="text-center text-sm text-muted-foreground">
            Вы инструктор? Вход только через{" "}
            <Link className="font-medium text-accent underline" href="/instructor/login">
              /instructor/login
            </Link>
            {" — иначе попадёте в раздел заказа клиента."}
          </p>
          <p className="text-center text-sm text-muted-foreground">
            <Link className="text-accent underline" href="/admin/login">
              Войти как администратор
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function ClientLoginForm() {
  return (
    <Suspense
      fallback={<div className="mx-auto max-w-md h-48 animate-pulse rounded-xl bg-muted/60" aria-hidden />}
    >
      <LoginFormInner />
    </Suspense>
  );
}
