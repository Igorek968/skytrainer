"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { useFormState, useFormStatus } from "react-dom";

import {
  signInWithCredentialsAction,
  type CredentialsSignInState,
} from "@/app/actions/credentials-sign-in";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const initialState: CredentialsSignInState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Вход…" : "Войти"}
    </Button>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl")?.trim() || "/client";
  const registered = params.get("registered") === "1";
  const prefilledEmail = params.get("email")?.trim() ?? "";

  const registerHref = useMemo(
    () => `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`,
    [callbackUrl],
  );

  const [state, formAction] = useFormState(signInWithCredentialsAction, initialState);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Вход клиента</CardTitle>
          <CardDescription>
            Войдите с email и паролем после{" "}
            <Link className="text-accent underline" href={registerHref}>
              регистрации
            </Link>
            , затем оформите заказ на{" "}
            <Link className="text-accent underline" href="/client">
              /client
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {registered ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Регистрация прошла успешно. Войдите с тем же email и паролем.
            </p>
          ) : null}

          <form className="space-y-4" action={formAction} noValidate>
            <input type="hidden" name="redirectTo" value={callbackUrl} />
            <input type="hidden" name="fallbackRedirect" value="/client" />

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={prefilledEmail}
                required
                aria-invalid={Boolean(state.error)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                aria-invalid={Boolean(state.error)}
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

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            <SubmitButton />
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Инструктор?{" "}
            <Link className="text-accent underline" href="/instructor/login">
              Вход в кабинет
            </Link>
            {" — доступ выдаёт администратор."}
          </p>
          <p className="text-center text-sm text-muted-foreground">
            Администратор:{" "}
            <Link className="text-accent underline" href="/admin/login">
              /admin/login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="mx-auto max-w-md h-48 animate-pulse rounded-xl bg-muted/60" aria-hidden />}
    >
      <LoginForm />
    </Suspense>
  );
}
