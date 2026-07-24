"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

import { hasCookieConsent } from "@/lib/cookie-consent";

const YANDEX_ID = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID?.trim() || "";
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";

function yandexMetrikaSnippet(counterId: string): string {
  return `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js?id=${counterId}","ym");window.dataLayer=window.dataLayer||[];ym(${counterId},"init",{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});`;
}

/** Яндекс.Метрика — сразу при загрузке страницы (как в стандартном коде счётчика). */
function YandexMetrika() {
  if (!YANDEX_ID) return null;

  return (
    <Script id="yandex-metrika" strategy="lazyOnload">
      {yandexMetrikaSnippet(YANDEX_ID)}
    </Script>
  );
}

/** Google Analytics — только после согласия на cookies. */
function GoogleAnalytics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!GA_ID) return;

    const sync = () => setEnabled(hasCookieConsent());
    sync();

    window.addEventListener("tvoytrener:cookie-consent", sync);
    return () => window.removeEventListener("tvoytrener:cookie-consent", sync);
  }, []);

  if (!enabled || !GA_ID) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true});`}
      </Script>
    </>
  );
}

export function SiteAnalytics() {
  return (
    <>
      <YandexMetrika />
      <GoogleAnalytics />
    </>
  );
}

export function yandexMetrikaCounterId(): string {
  return YANDEX_ID;
}
