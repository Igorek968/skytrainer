"use client";

import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export function PhoneOtpLogin({ callbackUrl }: { callbackUrl: string }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    setDevCode(null);
    try {
      const res = await fetch("/api/auth/phone/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; devCode?: string };
      if (!res.ok || !j.ok) {
        setError(j.error ?? "Не удалось отправить код");
        return;
      }
      if (j.devCode) setDevCode(j.devCode);
      setStep("code");
    } catch {
      setError("Ошибка сети");
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await signIn("credentials", {
        email: phone,
        otp: code,
        redirect: false,
      });
      if (result?.error) {
        setError("Неверный или просроченный код");
        setPending(false);
        return;
      }
      window.location.assign(callbackUrl);
    } catch {
      setError("Не удалось выполнить вход");
      setPending(false);
    }
  }

  if (step === "phone") {
    return (
      <form className="space-y-3" onSubmit={sendCode}>
        <div className="space-y-2">
          <Label htmlFor="phone-login">Телефон</Label>
          <Input
            id="phone-login"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 900 000-00-01"
            autoComplete="tel"
            disabled={pending}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" variant="outline" className="w-full" disabled={pending}>
          {pending ? "Отправка…" : "Получить код по SMS"}
        </Button>
      </form>
    );
  }

  return (
    <form className="space-y-3" onSubmit={verifyCode}>
      {devCode ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          Код для разработки: <strong>{devCode}</strong>
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="phone-otp">Код из SMS</Label>
        <Input
          id="phone-otp"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          disabled={pending}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Вход…" : "Войти"}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("phone")}>
        Другой номер
      </Button>
    </form>
  );
}
