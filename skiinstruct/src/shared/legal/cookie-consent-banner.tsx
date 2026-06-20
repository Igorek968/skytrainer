"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { acceptCookieConsent, hasCookieConsent } from "@/lib/cookie-consent";
import { LEGAL_ROUTES } from "@/lib/legal";
import { Button } from "@/shared/ui/button";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!hasCookieConsent());
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 p-3 shadow-lg backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-label="Уведомление об использовании cookies"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Сайт использует cookies и локальное хранилище для входа, безопасности и работы сервиса (в т.ч. реферальной
          программы). Продолжая пользоваться сайтом, вы соглашаетесь с{" "}
          <Link className="text-accent underline" href={LEGAL_ROUTES.privacy}>
            политикой обработки ПДн
          </Link>
          .
        </p>
        <Button
          type="button"
          variant="accent"
          size="sm"
          className="shrink-0"
          onClick={() => {
            acceptCookieConsent();
            setVisible(false);
            window.dispatchEvent(new CustomEvent("utrainer:cookie-consent"));
          }}
        >
          Принять
        </Button>
      </div>
    </div>
  );
}
