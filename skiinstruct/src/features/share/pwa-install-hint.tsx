"use client";

import { Download, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  dismissPwaHint,
  getDeferredInstallPrompt,
  isPwaHintDismissed,
  promptPwaInstall,
  pwaInstallInstructions,
  shouldOfferPwaInstall,
  subscribeInstallPrompt,
} from "@/features/share/pwa-install";
import { Button } from "@/shared/ui/button";

function useCanNativeInstall() {
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const sync = () => setCanInstall(Boolean(getDeferredInstallPrompt()));
    sync();
    return subscribeInstallPrompt(sync);
  }, []);

  return canInstall;
}

export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const canInstall = useCanNativeInstall();

  useEffect(() => {
    setVisible(shouldOfferPwaInstall() && !isPwaHintDismissed());
  }, []);

  if (!visible) return null;

  function close() {
    dismissPwaHint();
    setVisible(false);
  }

  async function onAdd() {
    if (!canInstall) return;
    setInstalling(true);
    try {
      const accepted = await promptPwaInstall();
      if (accepted) close();
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm md:hidden">
      <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-1">
          <p className="font-medium leading-snug">Мобильное приложение</p>
          <p className="text-xs text-muted-foreground">
            {canInstall
              ? "Установите ТвойТренер на телефон — быстрее открывать и пользоваться офлайн."
              : pwaInstallInstructions()}
          </p>
        </div>
        {canInstall ? (
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 px-3"
            disabled={installing}
            onClick={() => void onAdd()}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {installing ? "Установка…" : "Добавить"}
          </Button>
        ) : null}
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
  const [installing, setInstalling] = useState(false);
  const canInstall = useCanNativeInstall();

  useEffect(() => {
    setVisible(shouldOfferPwaInstall());
  }, []);

  if (!visible) return null;

  async function onAdd() {
    setInstalling(true);
    try {
      const accepted = await promptPwaInstall();
      if (accepted) onNavigate?.();
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-left text-sm">
      <p className="font-medium">Мобильное приложение</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {canInstall
          ? "Установите на телефон одним нажатием — ярлык на главном экране."
          : pwaInstallInstructions()}
      </p>
      {canInstall ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-60"
            disabled={installing}
            onClick={() => void onAdd()}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {installing ? "Установка…" : "Добавить"}
          </button>
          {onNavigate ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2"
              onClick={onNavigate}
            >
              Позже
            </button>
          ) : null}
        </div>
      ) : onNavigate ? (
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
