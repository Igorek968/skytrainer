"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSession, signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { signInClientSessionAction } from "@/app/actions/client-order-sign-in";
import {
  clearClientCheckoutDraft,
  readClientCheckoutDraft,
  saveClientCheckoutDraft,
} from "@/lib/client-checkout-draft";
import type { ClientCheckoutInstructorSummary } from "@/lib/client-checkout-instructor";
import { CLIENT_BOOKING_RETURN_PATH } from "@/lib/client-pending-checkout";
import { LEGAL_ROUTES } from "@/lib/legal";
import { InstructorServiceExecutorNotice } from "@/shared/legal/instructor-service-executor-notice";
import { LegalConsentCheckbox } from "@/shared/legal/legal-consent-checkbox";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { PasswordInput } from "@/shared/ui/password-input";
import { Label } from "@/shared/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instructor: ClientCheckoutInstructorSummary | null;
  /** Создать заказ AWAITING_PAYMENT; вернуть id заказа */
  onCreateOrder: () => Promise<string | null>;
};

type Step = "account" | "pay" | "wrongRole" | "busy";

export function ClientOrderCheckoutDialog({ open, onOpenChange, instructor, onCreateOrder }: Props) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [step, setStep] = useState<Step>("account");
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");
  const wasOpenRef = useRef(false);

  const sessionRole = session?.user?.role;
  const loggedIn = sessionStatus === "authenticated" && Boolean(session?.user);
  const loggedInAsClient = loggedIn && sessionRole === "CLIENT";
  const loggedInWrongRole = loggedIn && sessionRole !== "CLIENT";

  const cardQuery = useQuery({
    queryKey: ["me-card-status", session?.user?.id],
    queryFn: async () => {
      const r = await fetch("/api/me/payment-method", { cache: "no-store" });
      if (!r.ok) throw new Error("card");
      return r.json() as Promise<{
        hasCard: boolean;
        brand: string | null;
        last4: string | null;
        testCheckout?: boolean;
      }>;
    },
    enabled: open && loggedInAsClient,
  });
  const hasCard = Boolean(cardQuery.data?.hasCard);
  const testCheckout = Boolean(cardQuery.data?.testCheckout);

  useEffect(() => {
    if (!open || !instructor) {
      wasOpenRef.current = false;
      return;
    }
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (!justOpened || sessionStatus === "loading") return;

    const draft = readClientCheckoutDraft();
    if (draft?.instructorId === instructor.id) {
      setAcceptLegal(draft.acceptLegal);
      setAuthMode(draft.authMode);
      setEmail(draft.email);
      setPassword(draft.password);
      setPasswordConfirm(draft.passwordConfirm);
      setName(draft.name);
      if (loggedInWrongRole) setStep("wrongRole");
      else if (loggedInAsClient) setStep(draft.step === "account" ? "pay" : draft.step);
      else setStep(draft.step === "pay" ? "account" : draft.step);
      return;
    }

    setAcceptLegal(false);
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
    setName("");
    setAuthMode("register");
    if (loggedInWrongRole) setStep("wrongRole");
    else if (loggedInAsClient) setStep("pay");
    else setStep("account");
  }, [open, instructor, sessionStatus, loggedInAsClient, loggedInWrongRole]);

  useEffect(() => {
    if (!open || !instructor || step === "busy") return;
    saveClientCheckoutDraft({
      instructorId: instructor.id,
      instructorName: instructor.name,
      hourlyRate: instructor.hourlyRate,
      taxStatus: instructor.taxStatus ?? null,
      step: step === "wrongRole" ? "wrongRole" : step === "pay" ? "pay" : "account",
      authMode,
      email,
      password,
      passwordConfirm,
      name,
      acceptLegal,
    });
  }, [open, instructor, step, authMode, email, password, passwordConfirm, name, acceptLegal]);

  const estimatedTotal = useMemo(() => {
    if (!instructor?.hourlyRate) return null;
    return `от ${instructor.hourlyRate} ₽/ч + комиссия сервиса 15% (итог на экране оплаты)`;
  }, [instructor?.hourlyRate]);

  function closeAll() {
    clearClientCheckoutDraft();
    onOpenChange(false);
  }

  async function submitAccount(e: React.FormEvent) {
    e.preventDefault();
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
    if (!acceptLegal) {
      toast.error("Подтвердите согласие с офертой и обработкой персональных данных");
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
      clearClientCheckoutDraft();
      closeAll();
      router.push(`/client/orders/${orderId}?pay=1`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Сеть недоступна");
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
        <InstructorServiceExecutorNotice
          className="mt-3"
          instructorName={instructor.name}
          taxStatus={instructor.taxStatus}
        />

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
                onClick={() => {
                  clearClientCheckoutDraft();
                  onOpenChange(false);
                }}
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
              <PasswordInput
                id="co-pass"
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
                <PasswordInput
                  id="co-pass2"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => closeAll()}>
                Отмена
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
              <Button type="button" variant="outline" onClick={() => closeAll()}>
                Отмена
              </Button>
              <Button
                type="button"
                variant="accent"
                onClick={() => void signOut({ callbackUrl: CLIENT_BOOKING_RETURN_PATH })}
              >
                Выйти и войти как клиент
              </Button>
            </div>
          </div>
        ) : null}

        {step === "pay" ? (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Оплачивая заказ, вы заключаете договор с инструктором на занятие после его принятия заявки (п. 2.4–2.5{" "}
              <Link className="text-accent underline" href={LEGAL_ROUTES.oferta}>
                оферты
              </Link>
              ).
            </p>
            {loggedInAsClient ? (
              <p className="text-sm text-muted-foreground">
                Вы вошли как <span className="font-medium text-foreground">{session?.user?.email ?? "клиент"}</span>
              </p>
            ) : null}
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">
                {testCheckout ? "Тестовая оплата (без ЮKassa)" : "Оплата картой (ЮKassa)"}
              </p>
              {testCheckout ? (
                <p className="mt-1 text-amber-900 dark:text-amber-100">
                  Режим прогона: карта 4242 привязывается автоматически, оплата проходит без банка. Заявка сразу уйдёт
                  инструктору с уведомлениями.
                </p>
              ) : null}
              {cardQuery.isLoading ? (
                <p className="mt-1 text-muted-foreground">Проверяем привязку карты…</p>
              ) : hasCard ? (
                <p className="mt-1 text-muted-foreground">
                  Карта привязана ({cardQuery.data?.brand?.toUpperCase() ?? "CARD"} ••••{" "}
                  {cardQuery.data?.last4 ?? "****"}). После оплаты заявка уйдёт инструктору.
                </p>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  {testCheckout
                    ? "Карта ещё не привязана — на следующем шаге подставится тестовая карта и оплата пройдёт сразу."
                    : "Карта не привязана. На следующем шаге откроется форма ЮKassa: привязка карты и оплата заказа. Без карты заказ инструктору не отправится."}
                </p>
              )}
              {estimatedTotal ? <p className="mt-2 text-xs">{estimatedTotal}</p> : null}
            </div>
            <LegalConsentCheckbox
              id="checkout-accept-legal"
              checked={acceptLegal}
              onChange={setAcceptLegal}
              includeReturns
            />
            <div className="flex justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => (loggedInAsClient ? closeAll() : setStep("account"))}>
                {loggedInAsClient ? "Отмена" : "Назад"}
              </Button>
              <Button type="button" variant="accent" disabled={!acceptLegal} onClick={() => void payAndSend()}>
                {hasCard ? "Оформить заказ" : "Оформить заказ и привязать карту"}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "busy" ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">Подождите, создаём заказ…</p>
        ) : null}
      </div>
    </div>
  );
}
