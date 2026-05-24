"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMemo } from "react";
import { useFormState, useFormStatus } from "react-dom";

import {
  signInInstructorCredentialsAction,
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

export function InstructorLoginForm({
  applied = false,
  prefilledEmail = "",
  signInRequired = false,
  callbackUrl = "/instructor",
}: {
  applied?: boolean;
  prefilledEmail?: string;
  signInRequired?: boolean;
  callbackUrl?: string;
}) {
  const { data: session } = useSession();
  const [state, formAction] = useFormState(signInInstructorCredentialsAction, initialState);
  const signedInAsOther = Boolean(session?.user?.role && session.user.role !== "INSTRUCTOR");
  const safeCallback = useMemo(() => callbackUrl.trim() || "/instructor", [callbackUrl]);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Вход инструктора</CardTitle>
          <CardDescription>
            После одобрения заявки администратором войдите с email и паролем, указанными при регистрации. Новая заявка —{" "}
            <Link className="text-accent underline" href="/instructor/apply">
              /instructor/apply
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {signedInAsOther ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              Сейчас вы вошли как{" "}
              {session?.user?.role === "ADMIN" ? "администратор" : "клиент"}. Введите email инструктора — сессия будет
              заменена.
            </p>
          ) : null}
          {applied ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {signInRequired
                ? "Заявка создана. Войдите с email и паролем, которые указали в анкете — откроется кабинет инструктора."
                : "Заявка отправлена. Дождитесь одобрения в админке, затем войдите. Пока статус «на модерации» — поиск для клиентов недоступен."}
            </p>
          ) : null}

          <form className="space-y-4" action={formAction} noValidate>
            <input type="hidden" name="redirectTo" value={safeCallback} />
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
            Ещё не подавали заявку?{" "}
            <Link className="font-medium text-accent underline" href="/instructor/apply">
              Регистрация инструктора
            </Link>
          </p>
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
