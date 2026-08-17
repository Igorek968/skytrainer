"use client";

import Script from "next/script";
import { useCallback, useEffect, useId, useRef, useState } from "react";

type Props = {
  className?: string;
};

type SmartCaptchaApi = {
  render: (
    container: HTMLElement | string,
    params: {
      sitekey: string;
      hl?: string;
      callback?: (token: string) => void;
    },
  ) => number | string;
  destroy?: (widgetId?: number | string) => void;
  reset?: (widgetId?: number | string) => void;
  getResponse?: (widgetId?: number | string) => string;
};

declare global {
  interface Window {
    smartCaptcha?: SmartCaptchaApi;
  }
}

const BUILT_IN_KEY = process.env.NEXT_PUBLIC_SMARTCAPTCHA_CLIENT_KEY?.trim() || "";

/**
 * Яндекс SmartCaptcha через window.smartCaptcha.render (нужно для Next.js SPA).
 * Пишет токен в hidden captchaToken.
 */
export function CaptchaWidget({ className }: Props) {
  const reactId = useId().replace(/:/g, "");
  const containerId = `smart-captcha-${reactId}`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tokenInputRef = useRef<HTMLInputElement | null>(null);
  const widgetIdRef = useRef<number | string | null>(null);
  const [siteKey, setSiteKey] = useState(BUILT_IN_KEY);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (BUILT_IN_KEY) return;
    let cancelled = false;
    void fetch("/api/public/smartcaptcha-client-key", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { clientKey?: string }) => {
        if (!cancelled && j.clientKey?.trim()) setSiteKey(j.clientKey.trim());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setToken = useCallback((token: string) => {
    if (tokenInputRef.current) tokenInputRef.current.value = token;
  }, []);

  const mountWidget = useCallback(() => {
    const api = window.smartCaptcha;
    const el = containerRef.current;
    if (!api || !el || !siteKey) return;

    if (widgetIdRef.current != null) {
      try {
        api.destroy?.(widgetIdRef.current);
      } catch {
        /* ignore */
      }
      widgetIdRef.current = null;
      el.innerHTML = "";
    }

    try {
      widgetIdRef.current = api.render(el, {
        sitekey: siteKey,
        hl: "ru",
        callback: (token) => setToken(token),
      });
      setError(null);
    } catch (e) {
      console.error("[smartcaptcha] render failed", e);
      setError("Не удалось загрузить проверку «Я не робот». Обновите страницу.");
    }
  }, [setToken, siteKey]);

  useEffect(() => {
    if (!scriptReady || !siteKey) return;
    mountWidget();
    return () => {
      const api = window.smartCaptcha;
      if (api && widgetIdRef.current != null) {
        try {
          api.destroy?.(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
  }, [scriptReady, siteKey, mountWidget]);

  if (!siteKey && !BUILT_IN_KEY) {
    // Ключ ещё подгружается с API — плейсхолдер высоты
    return (
      <div className={className}>
        <div className="min-h-[100px] rounded-md border border-dashed border-border bg-muted/20" />
        <input ref={tokenInputRef} type="hidden" name="captchaToken" defaultValue="" />
      </div>
    );
  }

  if (!siteKey) return null;

  return (
    <div className={className}>
      <Script
        src="https://smartcaptcha.cloud.yandex.ru/captcha.js?render=onload"
        strategy="afterInteractive"
        onLoad={() => {
          if (window.smartCaptcha) setScriptReady(true);
          else {
            // иногда API появляется чуть позже onLoad
            const t = window.setInterval(() => {
              if (window.smartCaptcha) {
                window.clearInterval(t);
                setScriptReady(true);
              }
            }, 50);
            window.setTimeout(() => window.clearInterval(t), 5000);
          }
        }}
      />
      <div
        ref={containerRef}
        id={containerId}
        className="smart-captcha-host"
        style={{ minHeight: 100 }}
      />
      <input ref={tokenInputRef} type="hidden" name="captchaToken" defaultValue="" />
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/** @deprecated имя для совместимости со старыми импортами */
export function TurnstileWidget(props: Props) {
  return <CaptchaWidget {...props} />;
}
