"use client";

import { useState } from "react";

import { PlatformSupportDialog } from "@/features/support/platform-support-dialog";
import { Button } from "@/shared/ui/button";

/** Полноэкранная точка входа в поддержку (ссылка из подвала и юр. документов). */
export default function SupportPage() {
  const [open, setOpen] = useState(true);

  return (
    <div className="mx-auto max-w-lg space-y-4 py-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Поддержка платформы</h1>
      <p className="text-sm text-muted-foreground">
        Чат для вопросов об оплате, аккаунте и работе сервиса. По конкретному занятию пишите инструктору в чате заказа.
      </p>
      <Button type="button" variant="accent" onClick={() => setOpen(true)}>
        Открыть чат поддержки
      </Button>
      <PlatformSupportDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
