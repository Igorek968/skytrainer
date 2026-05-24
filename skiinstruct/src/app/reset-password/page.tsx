"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

function ResetPasswordForm() {
  const search = useSearchParams();
  const token = search.get("token");

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [debugToken, setDebugToken] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");

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
        toast.success("Ссылка для восстановления отправлена на email.");
      } else {
        toast.success("Если аккаунт существует — отправили ссылку для восстановления пароля.");
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

      const data = (await r.json().catch(() => ({}))) as { error?: unknown };
      if (!r.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Ошибка подтверждения");
        return;
      }
      toast.success("Пароль успешно обновлён. Можно входить.");
      window.location.href = "/instructor/login";
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
              <CardTitle>Установка нового пароля</CardTitle>
              <CardDescription>Введите новый пароль для аккаунта.</CardDescription>
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
                <Input
                  id="newPassword"
                  type="password"
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
                    Нажмите кнопку ниже, чтобы задать новый пароль (ссылка действует 1 час).
                  </p>
                  <Button className="mt-3 w-full" variant="accent" asChild>
                    <Link href={`/reset-password?token=${encodeURIComponent(debugToken)}`}>
                      Установить новый пароль
                    </Link>
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
