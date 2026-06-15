"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { signInClientSessionAction } from "@/app/actions/client-order-sign-in";
import { CLIENT_BOOKING_RETURN_PATH } from "@/lib/client-pending-checkout";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { PasswordInput } from "@/shared/ui/password-input";
import { Label } from "@/shared/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** После успешного входа — создать заказ; вернуть true если заказ ушёл */
  onAuthenticated: () => Promise<boolean>;
};

export function ClientOrderLoginDialog({ open, onOpenChange, onAuthenticated }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"form" | "order">("form");

  useEffect(() => {
    if (!open) return;
    setPhase("form");
    setEmail("");
    setPassword("");
  }, [open]);

  function closeAll() {
    setEmail("");
    setPassword("");
    setPhase("form");
    onOpenChange(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setPhase("form");
    try {
      const fd = new FormData();
      fd.set("email", email.trim());
      fd.set("password", password);
      const r = await signInClientSessionAction(fd);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      await getSession();
      router.refresh();
      setPhase("order");
      const ok = await onAuthenticated();
      if (!ok) {
        setPhase("form");
        return;
      }
      setEmail("");
      setPassword("");
      onOpenChange(false);
    } catch {
      toast.error("Сеть недоступна. Повторите попытку.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-order-login-title"
      onClick={() => !busy && closeAll()}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="client-order-login-title" className="text-lg font-semibold tracking-tight">
          {phase === "order" ? "Отправляем запрос" : "Вход для заказа"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {phase === "order"
            ? "Создаём заказ и откроем страницу с информацией о нём."
            : "Войдите под своим email и паролем, чтобы отправить запрос выбранному инструктору."}
        </p>

        <form className="mt-4 space-y-3" onSubmit={(e) => void submit(e)}>
          <div className="space-y-2">
            <Label htmlFor="col-email">Email</Label>
            <Input
              id="col-email"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="col-password">Пароль</Label>
            <PasswordInput
              id="col-password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Нет аккаунта?{" "}
            <Link
              className="text-accent underline"
              href={`/register?callbackUrl=${encodeURIComponent(CLIENT_BOOKING_RETURN_PATH)}`}
              onClick={() => closeAll()}
            >
              Зарегистрироваться
            </Link>
            {" — затем снова нажмите «Отправить запрос инструктору»."}
          </p>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => closeAll()}>
              Отмена
            </Button>
            <Button type="submit" variant="accent" disabled={busy}>
              {phase === "order" ? "Отправка…" : busy ? "Вход…" : "Войти и отправить"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
