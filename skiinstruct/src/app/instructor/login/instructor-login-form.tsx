"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSession } from "next-auth/react";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { PasswordInput } from "@/shared/ui/password-input";
import { Label } from "@/shared/ui/label";

export function InstructorLoginForm({
  applied = false,
  prefilledEmail = "",
  signInRequired = false,
  callbackUrl = "/instructor/pending",
}: {
  applied?: boolean;
  prefilledEmail?: string;
  signInRequired?: boolean;
  callbackUrl?: string;
}) {
  const { data: session } = useSession();
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signedInAsOther = Boolean(session?.user?.role && session.user.role !== "INSTRUCTOR");
  const safeCallback = useMemo(() => callbackUrl.trim() || "/instructor/pending", [callbackUrl]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail.includes("@")) {
      setError("Введите email инструктора");
      return;
    }
    if (!password) {
      setError("Введите пароль");
      return;
    }
    setPending(true);
    try {
      const result = await signIn("credentials", {
        email: trimmedEmail,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError(
          result.error === "Configuration"
            ? "Сбой настройки входа. Откройте сайт по тому же адресу, что в приложении, и перезапустите контейнер."
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
      window.location.assign(safeCallback);
    } catch {
      setError("Не удалось выполнить вход. Попробуйте ещё раз.");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Card>
        <CardHeader>
          <CardTitle as="h1">Вход инструктора</CardTitle>
          <CardDescription>
            Войдите с email и паролем, указанными при регистрации. После одобрения заявки администратором откроется
            кабинет инструктора.
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
                ? "Заявка создана. Войдите с email и паролем из анкеты — откроется экран ожидания модерации."
                : "Заявка отправлена. Дождитесь одобрения администратором — кабинет откроется после модерации."}
            </p>
          ) : null}

          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={pending}
                aria-invalid={Boolean(error)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={pending}
                aria-invalid={Boolean(error)}
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

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button className="w-full" type="submit" disabled={pending} aria-busy={pending}>
              {pending ? "Вход…" : "Войти"}
            </Button>
          </form>

          <Button variant="outline" className="w-full" asChild>
            <Link href="/instructor/apply?new=1">Стать инструктором</Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Заполните анкету и отправьте заявку на модерацию. Пока администратор не одобрит профиль, он не виден
            клиентам в поиске.
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
