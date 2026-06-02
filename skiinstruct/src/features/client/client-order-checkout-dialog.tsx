"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSession, signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { signInClientSessionAction } from "@/app/actions/client-order-sign-in";
import { CLIENT_BOOKING_RETURN_PATH } from "@/lib/client-pending-checkout";
import { LEGAL_ROUTES } from "@/lib/legal";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useQuery } from "@tanstack/react-query";

type InstructorSummary = {
  id: string;
  name: string | null;
  hourlyRate: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instructor: InstructorSummary | null;
  /** Создать заказ AWAITING_PAYMENT; вернуть id заказа */
  onCreateOrder: () => Promise<string | null>;
};

type Step = "legal" | "account" | "pay" | "wrongRole" | "busy";
type CardStatus = { hasCard: boolean; brand: string | null; last4: string | null };

export function ClientOrderCheckoutDialog({ open, onOpenChange, instructor, onCreateOrder }: Props) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [step, setStep] = useState<Step>("legal");
  const [acceptOferta, setAcceptOferta] = useState(false);
  const [acceptPd, setAcceptPd] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");

  const legalOk = acceptOferta && acceptPd;
  const sessionRole = session?.user?.role;
  const loggedIn = sessionStatus === "authenticated" && Boolean(session?.user);
  const loggedInAsClient = loggedIn && sessionRole === "CLIENT";
  const loggedInWrongRole = loggedIn && sessionRole !== "CLIENT";
  const cardQuery = useQuery({
    queryKey: ["me-card-status", session?.user?.id],
    queryFn: async () => {
      const r = await fetch("/api/me/payment-method", { cache: "no-store" });
      if (!r.ok) throw new Error("card");
      return r.json() as Promise<CardStatus>;
    },
    enabled: open && loggedInAsClient,
  });

  useEffect(() => {
    if (!open) return;
    setStep("legal");
    setAcceptOferta(false);
    setAcceptPd(false);
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
    setName("");
    setAuthMode("register");
  }, [open]);

  const estimatedTotal = useMemo(() => {
    if (!instructor?.hourlyRate) return null;
    return `от ${instructor.hourlyRate} ₽/ч + комиссия сервиса 15% (итог на экране оплаты)`;
  }, [instructor?.hourlyRate]);

  function closeAll() {
    onOpenChange(false);
  }

  function goNextFromLegal() {
    if (!legalOk) {
      toast.error("Подтвердите согласие с офертой и обработкой персональных данных");
      return;
    }
    if (sessionStatus === "loading") {
      toast.error("Проверяем вашу сессию, подождите секунду");
      return;
    }
    if (loggedInWrongRole) setStep("wrongRole");
    else if (loggedInAsClient) setStep("pay");
    else setStep("account");
  }

  async function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!legalOk) {
      toast.error("Сначала подтвердите согласия");
      setStep("legal");
      return;
    }
    setStep("busy");
    try {
      if (authMode === "register") {
        const r = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            password,
            passwordConfirm,
            name: name.trim() || undefined,
          }),
        });
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) {
          toast.error(j.error ?? "Не удалось зарегистрироваться");
          setStep("account");
          return;
        }
      }
      const fd = new FormData();
      fd.set("email", email.trim());
      fd.set("password", password);
      const sign = await signInClientSessionAction(fd);
      if (!sign.ok) {
        toast.error(sign.error);
        setStep("account");
        return;
      }
      await getSession();
      router.refresh();
      setStep("pay");
    } catch {
      toast.error("Сеть недоступна");
      setStep("account");
    }
  }

  async function payAndSend() {
    if (!legalOk) {
      setStep("legal");
      toast.error("Подтвердите согласия");
      return;
    }
    if (loggedInWrongRole) {
      setStep("wrongRole");
      return;
    }
    if (!loggedInAsClient) {
      setStep("account");
      toast.error("Войдите или зарегистрируйтесь как клиент");
      return;
    }
    setStep("busy");
    try {
      const orderId = await onCreateOrder();
      if (!orderId) {
        setStep("pay");
        return;
      }
      const r = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
        credentials: "include",
      });
      const raw = await r.text();
      const j = (() => {
        try {
          return (raw ? JSON.parse(raw) : {}) as { url?: string; error?: string };
        } catch {
          return {};
        }
      })();
      if (!r.ok || !j.url) {
        toast.error(typeof j.error === "string" ? j.error : "Не удалось перейти к оплате");
        setStep("pay");
        return;
      }
      window.location.href = j.url;
    } catch {
      toast.error("Сеть недоступна");
      setStep("pay");
    }
  }

  if (!open || !instructor) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-checkout-title"
      onClick={() => step !== "busy" && closeAll()}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="client-checkout-title" className="text-lg font-semibold tracking-tight">
          Оформление занятия
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Инструктор: <span className="font-medium text-foreground">{instructor.name ?? "—"}</span>
        </p>

        {step === "legal" ? (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Для юридически корректного оказания услуги на территории РФ: договор-оферта платформы, согласие на
              обработку персональных данных (152-ФЗ) и подтверждение платёжеспособности банковской картой перед
              отправкой заявки инструктору.
            </p>
            <label className="flex cursor-pointer gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={acceptOferta}
                onChange={(e) => setAcceptOferta(e.target.checked)}
              />
              <span>
                Принимаю{" "}
                <Link className="text-accent underline" href={LEGAL_ROUTES.oferta} target="_blank">
                  публичную оферту
                </Link>
                ,{" "}
                <Link className="text-accent underline" href={LEGAL_ROUTES.returns} target="_blank">
                  возвраты и отмену
                </Link>
              </span>
            </label>
            <label className="flex cursor-pointer gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={acceptPd} onChange={(e) => setAcceptPd(e.target.checked)} />
              <span>
                Согласен(на) на{" "}
                <Link className="text-accent underline" href={LEGAL_ROUTES.privacy} target="_blank">
                  обработку персональных данных
                </Link>{" "}
                для оформления заказа, оплаты и связи с инструктором
              </span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => closeAll()}>
                Отмена
              </Button>
              <Button type="button" variant="accent" onClick={() => goNextFromLegal()}>
                Далее
              </Button>
            </div>
          </div>
        ) : null}

        {step === "account" ? (
          <form className="mt-4 space-y-3" onSubmit={(e) => void submitAccount(e)}>
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                className={authMode === "register" ? "font-semibold text-accent underline" : "text-muted-foreground"}
                onClick={() => setAuthMode("register")}
              >
                Регистрация
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                type="button"
                className={authMode === "login" ? "font-semibold text-accent underline" : "text-muted-foreground"}
                onClick={() => setAuthMode("login")}
              >
                Вход
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Или{" "}
              <Link
                className="text-accent underline"
                href={`/login?callbackUrl=${encodeURIComponent(CLIENT_BOOKING_RETURN_PATH)}`}
                onClick={() => onOpenChange(false)}
              >
                войти на отдельной странице
              </Link>
              {" — после входа вернёт на заказ."}
            </p>
            {authMode === "register" ? (
              <div className="space-y-2">
                <Label htmlFor="co-name">Имя</Label>
                <Input id="co-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="co-email">Email</Label>
              <Input
                id="co-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="co-pass">Пароль</Label>
              <Input
                id="co-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={authMode === "register" ? "new-password" : "current-password"}
              />
            </div>
            {authMode === "register" ? (
              <div className="space-y-2">
                <Label htmlFor="co-pass2">Пароль ещё раз</Label>
                <Input
                  id="co-pass2"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            ) : null}
            {authMode === "register" ? (
              <p className="text-xs text-muted-foreground">
                Уже есть аккаунт?{" "}
                <Link
                  className="text-accent underline"
                  href={`/login?callbackUrl=${encodeURIComponent(CLIENT_BOOKING_RETURN_PATH)}`}
                  onClick={() => onOpenChange(false)}
                >
                  Вход на отдельной странице
                </Link>
              </p>
            ) : null}
            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep("legal")}>
                Назад
              </Button>
              <Button type="submit" variant="accent">
                Продолжить
              </Button>
            </div>
          </form>
        ) : null}

        {step === "wrongRole" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Сейчас вы вошли как{" "}
              <span className="font-medium text-foreground">
                {sessionRole === "INSTRUCTOR"
                  ? "инструктор"
                  : sessionRole === "ADMIN"
                    ? "администратор"
                    : "другой тип аккаунта"}
              </span>
              . Чтобы оформить занятие и оплатить, нужен аккаунт <strong>клиента</strong>.
            </p>
            <div className="flex flex-wrap justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("legal")}>
                Назад
              </Button>
              <Button
                type="button"
                variant="accent"
                onClick={() =>
                  void signOut({ callbackUrl: CLIENT_BOOKING_RETURN_PATH })
                }
              >
                Выйти и войти как клиент
              </Button>
            </div>
          </div>
        ) : null}

        {step === "pay" ? (
          <div className="mt-4 space-y-4">
            {loggedInAsClient ? (
              <p className="text-sm text-muted-foreground">
                Вы вошли как <span className="font-medium text-foreground">{session?.user?.email ?? "клиент"}</span>
              </p>
            ) : null}
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Оплата картой</p>
              {cardQuery.isLoading ? (
                <p className="mt-1 text-muted-foreground">Проверяем, привязана ли карта…</p>
              ) : cardQuery.data?.hasCard ? (
                <p className="mt-1 text-muted-foreground">
                  Привязанная карта{" "}
                  <span className="text-foreground">
                    {cardQuery.data.brand?.toUpperCase() ?? "CARD"} •••• {cardQuery.data.last4 ?? "****"}
                  </span>{" "}
                  будет использована для оплаты. После успешной оплаты заявка автоматически уйдёт инструктору.
                </p>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  Перед первой оплатой нужно добавить карту. После успешной оплаты заявка автоматически уйдёт
                  инструктору — это фиксирует договорённость для сторон.
                </p>
              )}
              {estimatedTotal ? <p className="mt-2 text-xs">{estimatedTotal}</p> : null}
            </div>
            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => (loggedInAsClient ? setStep("legal") : setStep("account"))}
              >
                Назад
              </Button>
              <Button type="button" variant="accent" onClick={() => void payAndSend()}>
                {cardQuery.data?.hasCard ? "Оплатить и отправить заявку" : "Добавить карту и отправить заявку"}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "busy" ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">Подождите, идёт оформление и переход к оплате…</p>
        ) : null}
      </div>
    </div>
  );
}
