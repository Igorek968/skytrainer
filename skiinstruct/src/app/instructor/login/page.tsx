"use client";

import Link from "next/link";
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

export default function InstructorLoginPage() {
  const [state, formAction] = useFormState(signInWithCredentialsAction, initialState);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Вход инструктора</CardTitle>
          <CardDescription>
            Email и пароль выдаёт администратор. Клиенты регистрируются по email на{" "}
            <Link className="text-accent underline" href="/register">
              /register
            </Link>
            , затем оформляют заказ на{" "}
            <Link className="text-accent underline" href="/client">
              /client
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            Нет учётной записи инструктора — обратитесь к администратору. Клиентам —{" "}
            <Link className="text-accent underline" href="/register">
              регистрация
            </Link>
            {" или "}
            <Link className="text-accent underline" href="/login">
              вход
            </Link>
            , затем{" "}
            <Link className="text-accent underline" href="/client">
              заказ на /client
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
