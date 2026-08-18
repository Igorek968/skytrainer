"use client";

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
      invisible?: boolean;
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
    __smartCaptchaScriptPromise?: Promise<void>;
  }
}

const SCRIPT_SRC = "https://smartcaptcha.cloud.yandex.ru/captcha.js?render=onload";
const BUILT_IN_KEY = process.env.NEXT_PUBLIC_SMARTCAPTCHA_CLIENT_KEY?.trim() || "";

function loadSmartCaptchaScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.smartCaptcha) return Promise.resolve();
  if (window.__smartCaptchaScriptPromise) return window.__smartCaptchaScriptPromise;

  window.__smartCaptchaScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src^="${SCRIPT_SRC}"]`);
    if (existing) {
      const started = Date.now();
      const tick = window.setInterval(() => {
        if (window.smartCaptcha) {
          window.clearInterval(tick);
          resolve();
        } else if (Date.now() - started > 10_000) {
          window.clearInterval(tick);
          reject(new Error("SmartCaptcha API timeout"));
        }
      }, 40);
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      const started = Date.now();
      const tick = window.setInterval(() => {
        if (window.smartCaptcha) {
          window.clearInterval(tick);
          resolve();
        } else if (Date.now() - started > 8_000) {
          window.clearInterval(tick);
          reject(new Error("SmartCaptcha API missing after load"));
        }
      }, 40);
    };
    script.onerror = () => reject(new Error("SmartCaptcha script failed"));
    document.head.appendChild(script);
  }).catch((err) => {
    window.__smartCaptchaScriptPromise = undefined;
    throw err;
  });

  return window.__smartCaptchaScriptPromise;
}

/**
 * Яндекс SmartCaptcha через window.smartCaptcha.render (SPA / диалоги).
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
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (BUILT_IN_KEY) return;
    let cancelled = false;
    void fetch("/api/public/smartcaptcha-client-key", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { clientKey?: string }) => {
        if (!cancelled && j.clientKey?.trim()) setSiteKey(j.clientKey.trim());
      })
      .catch(() => {
        if (!cancelled) {
          setPhase("error");
          setError("Не удалось получить ключ проверки. Обновите страницу.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    void loadSmartCaptchaScript()
      .then(() => {
        if (cancelled) return;
        setScriptReady(true);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("[smartcaptcha] script", e);
        setPhase("error");
        setError("Не удалось загрузить проверку «Я не робот». Обновите страницу или отключите блокировщик рекламы.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setToken = useCallback((token: string) => {
    if (tokenInputRef.current) tokenInputRef.current.value = token;
  }, []);

  const destroyWidget = useCallback(() => {
    const api = window.smartCaptcha;
    const el = containerRef.current;
    if (api && widgetIdRef.current != null) {
      try {
        api.destroy?.(widgetIdRef.current);
      } catch {
        /* ignore */
      }
      widgetIdRef.current = null;
    }
    if (el) el.innerHTML = "";
    setToken("");
  }, [setToken]);

  const mountWidget = useCallback(() => {
    const api = window.smartCaptcha;
    const el = containerRef.current;
    if (!api || !el || !siteKey) return false;

    destroyWidget();

    try {
      widgetIdRef.current = api.render(el, {
        sitekey: siteKey,
        hl: "ru",
        invisible: false,
        callback: (token) => setToken(token || ""),
      });
      setError(null);
      setPhase("ready");
      return true;
    } catch (e) {
      console.error("[smartcaptcha] render failed", e);
      setPhase("error");
      setError("Не удалось показать проверку «Я не робот». Обновите страницу.");
      return false;
    }
  }, [destroyWidget, setToken, siteKey]);

  useEffect(() => {
    if (!scriptReady || !siteKey) return;

    const el = containerRef.current;
    if (!el) return;

    let mounted = false;
    const tryMount = () => {
      if (mounted) return;
      // Закрытый/скрытый контейнер (display:none) — ждём. fixed/absolute в диалоге OK.
      if (el.getClientRects().length === 0) return;
      mounted = mountWidget();
    };

    tryMount();

    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              if (entries.some((e) => e.isIntersecting && e.intersectionRatio > 0)) {
                tryMount();
              }
            },
            { threshold: 0.01 },
          )
        : null;
    io?.observe(el);

    // Диалоги / вкладки: remount когда окно снова видно
    const onVis = () => {
      if (document.visibilityState === "visible") {
        mounted = false;
        tryMount();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const retry = window.setTimeout(() => {
      if (!mounted) tryMount();
      if (!mounted && !widgetIdRef.current) {
        setPhase("error");
        setError("Проверка «Я не робот» не отобразилась. Прокрутите к кнопке или обновите страницу.");
      }
    }, 2500);

    return () => {
      window.clearTimeout(retry);
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      destroyWidget();
    };
  }, [scriptReady, siteKey, mountWidget, destroyWidget]);

  return (
    <div className={className}>
      <p className="mb-1.5 text-xs font-medium text-foreground">Проверка: я не робот</p>
      {!siteKey && phase !== "error" ? (
        <div
          className="flex min-h-[100px] items-center rounded-md border border-dashed border-border bg-muted/30 px-3 text-xs text-muted-foreground"
          aria-busy="true"
        >
          Загрузка проверки…
        </div>
      ) : (
        <div className="relative min-h-[100px] overflow-visible rounded-md border border-border bg-background p-1">
          {phase === "loading" ? (
            <div className="absolute inset-0 z-0 flex items-center px-3 text-xs text-muted-foreground">
              Загрузка проверки…
            </div>
          ) : null}
          <div
            ref={containerRef}
            id={containerId}
            className="smart-captcha-host relative z-10 min-h-[92px] overflow-visible"
          />
        </div>
      )}
      <input ref={tokenInputRef} type="hidden" name="captchaToken" defaultValue="" />
      {error ? (
        <p className="mt-1.5 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">Отметьте галочку перед отправкой формы.</p>
      )}
    </div>
  );
}

/** @deprecated имя для совместимости со старыми импортами */
export function TurnstileWidget(props: Props) {
  return <CaptchaWidget {...props} />;
}
