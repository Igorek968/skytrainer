"use client";

import { Download, Share, Smartphone, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  dismissPwaHint,
  getDeferredInstallPrompt,
  getPwaInstallGuide,
  isPwaHintDismissed,
  promptPwaInstall,
  shouldOfferPwaInstall,
  subscribeInstallPrompt,
  type PwaInstallGuide,
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

function useInstallGuide(canNativeInstall: boolean): PwaInstallGuide | null {
  const [guide, setGuide] = useState<PwaInstallGuide | null>(null);

  useEffect(() => {
    setGuide(getPwaInstallGuide(canNativeInstall));
  }, [canNativeInstall]);

  return guide;
}

function InstallSteps({ steps, className }: { steps: string[]; className?: string }) {
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

/**
 * Всплывающее окно установки PWA под браузеры РФ (Android + iOS):
 * Chrome, Яндекс, Safari, Samsung, Opera, Firefox, MIUI, Edge.
 */
export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [installing, setInstalling] = useState(false);
  const canInstall = useCanNativeInstall();
  const guide = useInstallGuide(canInstall);

  const forceSteps = useMemo(() => {
    if (!guide) return false;
    return guide.strategy === "manual_steps" || guide.strategy === "safari_required" || guide.strategy === "external_browser" || !guide.useNativePrompt;
  }, [guide]);

  useEffect(() => {
    if (!shouldOfferPwaInstall() || isPwaHintDismissed()) return;
    const t = window.setTimeout(() => {
      setVisible(true);
      const g = getPwaInstallGuide(Boolean(getDeferredInstallPrompt()));
      if (g.strategy !== "native_prompt" || !g.useNativePrompt) {
        setShowSteps(true);
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!canInstall || isPwaHintDismissed()) return;
    setVisible(true);
  }, [canInstall]);

  if (!visible || !guide) return null;

  const nativeReady = guide.useNativePrompt && canInstall;

  function close() {
    dismissPwaHint();
    setVisible(false);
  }

  async function onInstall() {
    if (!nativeReady) {
      if (showSteps || forceSteps) {
        close();
        return;
      }
      setShowSteps(true);
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

  const primaryLabel = installing
    ? "Установка…"
    : nativeReady
      ? "Установить"
      : showSteps || forceSteps
        ? "Понятно"
        : "Как установить";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-4 sm:items-center lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
      aria-describedby="pwa-install-desc"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Закрыть" onClick={close} />
      <div className="relative z-[1] w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-start gap-3 border-b border-border bg-accent/10 px-4 py-3.5">
          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            {guide.platform === "ios" ? (
              <Share className="h-5 w-5" aria-hidden />
            ) : (
              <Smartphone className="h-5 w-5" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p id="pwa-install-title" className="text-base font-semibold leading-snug">
              {guide.title}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-accent">{guide.browserLabel}</p>
            <p id="pwa-install-desc" className="mt-1 text-sm text-muted-foreground">
              {guide.description}
            </p>
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

        <div className="space-y-3 px-4 py-3.5">
          {showSteps || forceSteps || guide.platform === "ios" ? (
            <InstallSteps steps={guide.steps} />
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              className="h-11 w-full gap-2 sm:w-auto sm:flex-1"
              disabled={installing}
              onClick={() => void onInstall()}
            >
              <Download className="h-4 w-4" aria-hidden />
              {primaryLabel}
            </Button>
            <Button type="button" variant="outline" className="h-11 w-full sm:w-auto" onClick={close}>
              Не сейчас
            </Button>
          </div>

          {guide.footnote ? (
            <p className="text-[11px] leading-snug text-muted-foreground">{guide.footnote}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PwaInstallMenuItem({ onNavigate }: { onNavigate?: () => void }) {
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const canInstall = useCanNativeInstall();
  const guide = useInstallGuide(canInstall);

  useEffect(() => {
    setVisible(shouldOfferPwaInstall());
  }, []);

  if (!visible || !guide) return null;

  const nativeReady = guide.useNativePrompt && canInstall;

  async function onAdd() {
    if (!nativeReady) {
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
      <p className="mt-0.5 text-[11px] text-accent">{guide.browserLabel}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{guide.description}</p>
      {showSteps || !nativeReady ? (
        <InstallSteps steps={guide.steps} className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted-foreground" />
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-60"
          disabled={installing}
          onClick={() => void onAdd()}
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          {installing ? "Установка…" : nativeReady ? "Установить" : "Как установить"}
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
