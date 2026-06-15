"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { cabinetPathForRole } from "@/lib/auth-routes";
import type { UserRole } from "@prisma/client";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { PasswordInput } from "@/shared/ui/password-input";
import { Label } from "@/shared/ui/label";

function homeForRole(role: UserRole | undefined): string {
  return cabinetPathForRole(role) ?? "/login";
}

function ResetPasswordForm() {
  const search = useSearchParams();
  const { data: session } = useSession();
  const token = search.get("token");
  const signedIn = search.get("signedIn") === "1";
  const linkError = search.get("error");
  const cabinetHref = homeForRole(session?.user?.role);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [debugToken, setDebugToken] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!token || signedIn) return;
    const enterUrl = `/api/auth/password-reset/enter?token=${encodeURIComponent(token)}&next=reset`;
    window.location.replace(enterUrl);
  }, [token, signedIn]);

  useEffect(() => {
    if (linkError === "invalid") {
      toast.error("Ссылка недействительна или устарела.");
    }
  }, [linkError]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setDebugToken(null);
    try {
      const r = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: unknown;
        debugToken?: string;
        sent?: boolean;
        resetLink?: string;
      };

      if (!r.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Ошибка запроса сброса пароля");
        return;
      }

      if (data.debugToken) {
        setDebugToken(data.debugToken);
        toast.message("Письмо на локальном стенде не отправляется — используйте ссылку ниже.");
      } else if (data.sent) {
        toast.success("Ссылка отправлена на email. Проверьте входящие и папку «Спам».");
      } else {
        toast.error(
          "Не удалось отправить письмо. Попробуйте позже или напишите в поддержку.",
        );
      }
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const onConfirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = (await r.json().catch(() => ({}))) as { error?: unknown; role?: UserRole };
      if (!r.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Ошибка подтверждения");
        return;
      }
      toast.success("Пароль успешно обновлён.");
      window.location.href = homeForRole(data.role);
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  if (token && !signedIn) {
    return (
      <div className="mx-auto max-w-md p-6 text-sm text-muted-foreground">Вход по ссылке…</div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="flex items-center justify-between">
        <Link className="text-sm text-accent underline" href="/">
          ← На главную
        </Link>
      </div>

      <Card>
        <CardHeader>
          {token ? (
            <>
              <CardTitle>Установка нового пароля</CardTitle>
              <CardDescription>
                {signedIn
                  ? "Вы вошли по ссылке из письма. Можно задать новый пароль или перейти в кабинет."
                  : "Введите новый пароль для аккаунта."}
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle>Восстановление пароля</CardTitle>
              <CardDescription>
                Введите email — мы отправим ссылку на установку нового пароля.
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {token ? (
            <form className="space-y-4" onSubmit={onConfirm} noValidate>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Новый пароль</Label>
                <PasswordInput
                  id="newPassword"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? "Сохранение..." : "Сохранить пароль"}
              </Button>

              {signedIn ? (
                <Button className="w-full" variant="outline" type="button" asChild>
                  <Link href={cabinetHref}>Перейти в кабинет без смены пароля</Link>
                </Button>
              ) : null}
            </form>
          ) : (
            <>
              <form className="space-y-4" onSubmit={onSubmit} noValidate>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button className="w-full" type="submit" disabled={loading}>
                  {loading ? "Отправка..." : "Отправить ссылку"}
                </Button>
              </form>

              <p className="text-sm text-muted-foreground">
                В целях безопасности мы не подтверждаем наличие аккаунта по введённому email.
              </p>

              {debugToken ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                  <p className="font-medium">Локальный стенд: письмо не уходит</p>
                  <p className="mt-1 text-xs opacity-90">
                    Нажмите кнопку ниже — откроется кабинет (ссылка действует 1 час).
                  </p>
                  <Button className="mt-3 w-full" variant="accent" asChild>
                    <a
                      href={`/api/auth/password-reset/enter?token=${encodeURIComponent(debugToken)}`}
                    >
                      Войти по ссылке
                    </a>
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md p-6 text-sm text-muted-foreground">Загрузка…</div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
