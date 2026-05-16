"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import {
  signInAdminCredentialsAction,
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
      Войти в админку
    </Button>
  );
}

export default function AdminLoginPage() {
  const [state, formAction] = useFormState(signInAdminCredentialsAction, initialState);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SkiInstruct — вход администратора</CardTitle>
          <CardDescription>Кабинет привязан к этому приложению. Доступ только для роли ADMIN.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" action={formAction} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
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

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            <SubmitButton />
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Сайт для клиентов:{" "}
            <Link className="text-accent underline" href="/">
              главная
            </Link>
            , регистрация —{" "}
            <Link className="text-accent underline" href="/register">
              /register
            </Link>
            , вход —{" "}
            <Link className="text-accent underline" href="/login">
              /login
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
