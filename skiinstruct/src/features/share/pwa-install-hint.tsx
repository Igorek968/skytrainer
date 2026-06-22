"use client";

import { Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  dismissPwaHint,
  isPwaHintDismissed,
  pwaInstallInstructions,
  shouldOfferPwaInstall,
} from "@/features/share/pwa-install";
import { Button } from "@/shared/ui/button";

export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(shouldOfferPwaInstall() && !isPwaHintDismissed());
  }, []);

  if (!visible) return null;

  function close() {
    dismissPwaHint();
    setVisible(false);
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm md:hidden">
      <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium leading-snug">Добавьте на главный экран</p>
        <p className="text-xs text-muted-foreground">{pwaInstallInstructions()}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        aria-label="Скрыть подсказку"
        onClick={close}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function PwaInstallMenuItem({ onNavigate }: { onNavigate?: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(shouldOfferPwaInstall());
  }, []);

  if (!visible) return null;

  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-left text-sm">
      <p className="font-medium">Мобильное приложение</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{pwaInstallInstructions()}</p>
      {onNavigate ? (
        <button
          type="button"
          className="mt-1 text-xs text-accent underline underline-offset-2"
          onClick={onNavigate}
        >
          Понятно
        </button>
      ) : null}
    </div>
  );
}
