"use client";

import { Download, Share, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  dismissPwaHint,
  getDeferredInstallPrompt,
  getPwaPlatform,
  isPwaHintDismissed,
  promptPwaInstall,
  pwaInstallSteps,
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

function InstallSteps({ className }: { className?: string }) {
  const steps = pwaInstallSteps();
  return (
    <ol className={className ?? "list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground"}>
      {steps.map((step) => (
        <li key={step} className="leading-snug">
          {step}
        </li>
      ))}
    </ol>
  );
}

/** Нижний баннер на мобильных: системная установка (Android) или пошаговая инструкция (iOS / Яндекс). */
export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [installing, setInstalling] = useState(false);
  const canInstall = useCanNativeInstall();
  const platform = typeof window === "undefined" ? "android" : getPwaPlatform();

  useEffect(() => {
    if (!shouldOfferPwaInstall() || isPwaHintDismissed()) return;
    // Небольшая пауза — SW успевает зарегистрироваться, beforeinstallprompt — дойти.
    const t = window.setTimeout(() => setVisible(true), 1200);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!canInstall) return;
    setVisible((v) => (isPwaHintDismissed() ? v : true));
    setExpanded(true);
  }, [canInstall]);

  if (!visible) return null;

  function close() {
    dismissPwaHint();
    setVisible(false);
  }

  async function onAdd() {
    if (!canInstall) {
      if (expanded) {
        close();
        return;
      }
      setExpanded(true);
      return;
    }
    setInstalling(true);
    try {
      const accepted = await promptPwaInstall();
      if (accepted) close();
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-background/95 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md md:hidden"
      role="dialog"
      aria-label="Установить приложение"
    >
      <div className="mx-auto flex max-w-lg items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          {platform === "ios" ? (
            <Share className="h-5 w-5" aria-hidden />
          ) : (
            <Smartphone className="h-5 w-5" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold leading-snug">Установить ТвойТренер</p>
            <p className="text-xs text-muted-foreground">
              {canInstall
                ? "Версия для Android — ярлык как у обычного приложения."
                : platform === "ios"
                  ? "Версия для iPhone / iPad — добавьте на экран «Домой» через Safari."
                  : "Версия для Android — установите из меню браузера или кнопкой ниже."}
            </p>
          </div>
          {expanded || !canInstall ? <InstallSteps /> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-9 gap-1.5 px-3"
              disabled={installing}
              onClick={() => void onAdd()}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              {installing
                ? "Установка…"
                : canInstall
                  ? "Установить"
                  : expanded
                    ? "Понятно"
                    : "Как установить"}
            </Button>
            {!canInstall && !expanded ? (
              <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => setExpanded(true)}>
                Показать шаги
              </Button>
            ) : null}
            {expanded && !canInstall ? (
              <Button type="button" size="sm" variant="ghost" className="h-9" onClick={close}>
                Закрыть
              </Button>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Скрыть"
          onClick={close}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function PwaInstallMenuItem({ onNavigate }: { onNavigate?: () => void }) {
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const canInstall = useCanNativeInstall();

  useEffect(() => {
    setVisible(shouldOfferPwaInstall());
  }, []);

  if (!visible) return null;

  async function onAdd() {
    if (!canInstall) {
      setShowSteps(true);
      return;
    }
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
          : "Добавьте ТвойТренер на главный экран (Android и iOS)."}
      </p>
      {showSteps ? <InstallSteps className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted-foreground" /> : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-60"
          disabled={installing}
          onClick={() => void onAdd()}
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          {installing ? "Установка…" : canInstall ? "Установить" : "Как установить"}
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
    </div>
  );
}
