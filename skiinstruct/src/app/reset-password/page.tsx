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
import { TurnstileWidget } from "@/shared/security/turnstile-widget";

function homeForRole(role: UserRole | undefined): string {
  return cabinetPathForRole(role) ?? "/login";
}

function loginPathForRole(role: UserRole | undefined, email?: string | null): string {
  const base = role === "INSTRUCTOR" ? "/instructor/login" : "/login";
  const sp = new URLSearchParams();
  sp.set("passwordReset", "1");
  if (email?.trim()) sp.set("email", email.trim());
  return `${base}?${sp.toString()}`;
}

function ResetPasswordForm() {
  const search = useSearchParams();
  const { data: session } = useSession();
  const token = search.get("token")?.trim() || null;
  const signedIn = search.get("signedIn") === "1";
  const linkError = search.get("error");
  const cabinetHref = homeForRole(session?.user?.role);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [debugToken, setDebugToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  useEffect(() => {
    if (linkError === "invalid") {
      toast.error("Ссылка недействительна или устарела. Запросите новую.");
    }
  }, [linkError]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setDebugToken(null);
    const formData = new FormData(e.currentTarget);
    const captchaToken = String(formData.get("captchaToken") ?? "");
    try {
      const r = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, captchaToken }),
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
      } else if (data.sent === false) {
        toast.error("Не удалось отправить письмо. Попробуйте позже или напишите в поддержку.");
      } else {
        // sent === true или аккаунта нет (тот же ответ — не раскрываем существование)
        toast.success("Если такой email есть в системе — ссылка уже в письме. Проверьте входящие и «Спам».");
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
    if (newPassword.length < 8) {
      toast.error("Пароль не короче 8 символов");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error("Пароли не совпадают");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = (await r.json().catch(() => ({}))) as {
        error?: unknown;
        role?: UserRole;
        email?: string;
      };
      if (!r.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Ошибка подтверждения");
        return;
      }
      toast.success("Пароль обновлён — войдите с новым паролем.");
      window.location.href = loginPathForRole(data.role, data.email);
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

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
              <CardTitle as="h1">Установка нового пароля</CardTitle>
              <CardDescription>
                Придумайте новый пароль для входа. Ссылка из письма действует 1 час.
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle as="h1">Восстановление пароля</CardTitle>
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
              <div className="space-y-2">
                <Label htmlFor="newPasswordConfirm">Повторите пароль</Label>
                <PasswordInput
                  id="newPasswordConfirm"
                  autoComplete="new-password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? "Сохранение..." : "Сохранить пароль"}
              </Button>

              {signedIn || session?.user ? (
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
                <TurnstileWidget />
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
                    Нажмите кнопку ниже — откроется форма нового пароля (ссылка действует 1 час).
                  </p>
                  <Button className="mt-3 w-full" variant="accent" asChild>
                    <a href={`/reset-password?token=${encodeURIComponent(debugToken)}`}>
                      Открыть смену пароля
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
