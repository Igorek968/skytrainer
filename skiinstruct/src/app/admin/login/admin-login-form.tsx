"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useFormState, useFormStatus } from "react-dom";

import {
  signInAdminCredentialsAction,
  type CredentialsSignInState,
} from "@/app/actions/credentials-sign-in";
import { sanitizeRedirectPath } from "@/lib/sanitize-auth-redirect";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { PasswordInput } from "@/shared/ui/password-input";
import { Label } from "@/shared/ui/label";
import { getPublicProductName } from "@/shared/lib/product";
import { useMemo } from "react";

const initialState: CredentialsSignInState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" type="submit" disabled={pending} aria-busy={pending}>
      Войти в админку
    </Button>
  );
}

export function AdminLoginForm({ callbackUrl = "/admin/metrics" }: { callbackUrl?: string }) {
  const { data: session } = useSession();
  const [state, formAction] = useFormState(signInAdminCredentialsAction, initialState);
  const signedInAsOther = Boolean(
    session?.user?.role && session.user.role !== "ADMIN" && session.user.role !== "MODERATOR",
  );
  const productName = getPublicProductName();
  const safeCallback = useMemo(
    () => sanitizeRedirectPath(callbackUrl, "/admin/metrics"),
    [callbackUrl],
  );

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Card>
        <CardHeader>
          <CardTitle as="h1">{productName} — вход в админку</CardTitle>
          <CardDescription>
            Для администратора и модератора. Модератор работает без раздела «Финансы».
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {signedInAsOther ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              Сейчас вы вошли как пользователь ({session?.user?.role === "INSTRUCTOR" ? "инструктор" : "клиент"}
              ). Введите email и пароль администратора — сессия будет заменена. Для проверки анкеты инструктора
              используйте отдельное окно браузера или режим инкогнито.
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
                required
                aria-invalid={Boolean(state.error)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                required
                aria-invalid={Boolean(state.error)}
              />
            </div>

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            <SubmitButton />
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Инструктор:{" "}
            <Link className="text-accent underline" href="/instructor/login">
              /instructor/login
            </Link>
            . Клиент:{" "}
            <Link className="text-accent underline" href="/login">
              /login
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
