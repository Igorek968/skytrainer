"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
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
      Войти
    </Button>
  );
}

function InstructorLoginForm() {
  const params = useSearchParams();
  const applied = params.get("applied") === "1";
  const prefilledEmail = params.get("email")?.trim() ?? "";

  const [state, formAction] = useFormState(signInWithCredentialsAction, initialState);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Вход инструктора</CardTitle>
          <CardDescription>
            После одобления заявки администратором войдите с email и паролем, указанными при регистрации. Новая заявка —{" "}
            <Link className="text-accent underline" href="/instructor/apply">
              /instructor/apply
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {applied ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Заявка отправлена. Дождитесь одобрения в админке, затем войдите. Пока статус «на модерации» — кабинет и
              поиск недоступны.
            </p>
          ) : null}

          <form className="space-y-4" action={formAction} noValidate>
            <input type="hidden" name="redirectTo" value="/instructor" />
            <input type="hidden" name="fallbackRedirect" value="/instructor" />

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

            <div className="flex justify-end">
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
            Клиентам —{" "}
            <Link className="text-accent underline" href="/register">
              регистрация
            </Link>
            {" или "}
            <Link className="text-accent underline" href="/login">
              вход
            </Link>
            , заказ —{" "}
            <Link className="text-accent underline" href="/client">
              /client
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InstructorLoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-48 max-w-md animate-pulse rounded-xl bg-muted/60" aria-hidden />}>
      <InstructorLoginForm />
    </Suspense>
  );
}
