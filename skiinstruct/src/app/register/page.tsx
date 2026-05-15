"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { registerClientAction, type RegisterClientState } from "@/app/actions/register-client";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const initialState: RegisterClientState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Регистрация…" : "Зарегистрироваться"}
    </Button>
  );
}

function RegisterForm() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl")?.trim() || "/client";

  const [state, formAction] = useFormState(registerClientAction, initialState);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Регистрация</CardTitle>
          <CardDescription>
            Укажите email и пароль — после регистрации вы сразу войдёте и сможете оформить заказ на{" "}
            <Link className="text-accent underline" href="/client">
              /client
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" action={formAction} noValidate>
            <input type="hidden" name="redirectTo" value={callbackUrl} />

            <div className="space-y-2">
              <Label htmlFor="reg-name">Имя (необязательно)</Label>
              <Input id="reg-name" name="name" type="text" autoComplete="name" maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-email">Email</Label>
              <Input
                id="reg-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                aria-invalid={Boolean(state.error)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password">Пароль</Label>
              <Input
                id="reg-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                aria-invalid={Boolean(state.error)}
              />
              <p className="text-xs text-muted-foreground">Не меньше 8 символов.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password2">Пароль ещё раз</Label>
              <Input
                id="reg-password2"
                name="passwordConfirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                aria-invalid={Boolean(state.error)}
              />
            </div>

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            <SubmitButton />
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Уже есть аккаунт?{" "}
            <Link className="text-accent underline" href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
              Войти
            </Link>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            Инструктор?{" "}
            <Link className="text-accent underline" href="/instructor/login">
              Вход в кабинет
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={<div className="mx-auto max-w-md h-48 animate-pulse rounded-xl bg-muted/60" aria-hidden />}
    >
      <RegisterForm />
    </Suspense>
  );
}
