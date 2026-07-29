"use client";

import { useState } from "react";

import {
  SUPPORT_TELEGRAM_HANDLE,
  supportEmail,
  supportMaxUrl,
  supportTelegramUrl,
} from "@/lib/support-config";
import { PlatformSupportDialog } from "@/features/support/platform-support-dialog";
import { Button } from "@/shared/ui/button";

/** Полноэкранная точка входа в поддержку (ссылка из подвала и юр. документов). */
export default function SupportPage() {
  const [open, setOpen] = useState(true);
  const email = supportEmail();
  const telegramUrl = supportTelegramUrl();
  const maxUrl = supportMaxUrl();

  return (
    <div className="mx-auto max-w-lg space-y-4 py-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Поддержка платформы</h1>
      <p className="text-sm text-muted-foreground">
        Чат для вопросов об оплате, аккаунте и работе сервиса. По конкретному занятию пишите инструктору в чате заказа.
      </p>
      <p className="text-sm text-muted-foreground">
        Email:{" "}
        <a className="text-accent underline" href={`mailto:${email}`}>
          {email}
        </a>
        {" · "}
        Telegram:{" "}
        <a className="text-accent underline" href={telegramUrl} target="_blank" rel="noopener noreferrer">
          {SUPPORT_TELEGRAM_HANDLE}
        </a>
        {" · "}
        MAX:{" "}
        <a className="text-accent underline" href={maxUrl} target="_blank" rel="noopener noreferrer">
          администратор
        </a>
      </p>
      <Button type="button" variant="accent" onClick={() => setOpen(true)}>
        Открыть чат поддержки
      </Button>
      <PlatformSupportDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
