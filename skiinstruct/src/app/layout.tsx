import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { auth } from "@/auth";
import { AppProviders } from "@/app/providers";
import { SEO_PAGES, absoluteUrl, siteJsonLd } from "@/lib/seo";
import { getPublicProductName } from "@/shared/lib/product";
import { SiteAnalytics } from "@/shared/analytics/site-analytics";
import { YandexMetrikaNoscript } from "@/shared/analytics/yandex-metrika-noscript";
import { CookieConsentBanner } from "@/shared/legal/cookie-consent-banner";
import { SiteFooter } from "@/shared/layout/site-footer";
import { SiteHeader } from "@/shared/layout/site-header";

import "./globals.css";

const metadataBaseUrl = (() => {
  const raw =
    process.env.APP_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "https://твойтренер.рф";
  try {
    const url = new URL(raw);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      url.protocol = "https:";
    }
    return url;
  } catch {
    return new URL("https://твойтренер.рф");
  }
})();

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

const appName = getPublicProductName();

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl,
  title: {
    default: SEO_PAGES.home.title,
    template: `%s | ${appName}`,
  },
  description: SEO_PAGES.home.description,
  manifest: "/manifest.webmanifest",
  applicationName: appName,
  appleWebApp: {
    capable: true,
    title: appName,
    statusBarStyle: "black-translucent",
  },
  icons: {
    // SVG + 120px first — Яндекс рекомендует их для логотипа в выдаче
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/favicon-120.png", sizes: "120x120", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-touch-icon.png?v=brand7", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: appName,
    title: SEO_PAGES.home.title,
    description: SEO_PAGES.home.description,
    url: absoluteUrl(SEO_PAGES.home.path),
    images: [
      {
        url: "/brand/press/logo-horizontal-on-white.png",
        width: 1099,
        height: 516,
        alt: appName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_PAGES.home.title,
    description: SEO_PAGES.home.description,
    images: ["/brand/press/logo-horizontal-on-white.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const jsonLd = siteJsonLd();

  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Относительные пути: робот Яндекса берёт их с того же https-хоста */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
        <link rel="icon" href="/favicon-120.png" type="image/png" sizes="120x120" />
        <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="preconnect" href="https://api-maps.yandex.ru" />
        <link rel="preconnect" href="https://yastatic.net" crossOrigin="" />
        <link rel="dns-prefetch" href="https://mc.yandex.ru" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
      </head>
      <body className={`${inter.variable} min-h-dvh font-sans`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <AppProviders session={session}>
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-6">
            {children}
          </main>
          <SiteFooter />
          <CookieConsentBanner />
          <SiteAnalytics />
          <YandexMetrikaNoscript />
        </AppProviders>
      </body>
    </html>
  );
}
