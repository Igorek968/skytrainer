import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { auth } from "@/auth";
import { AppProviders } from "@/app/providers";
import { SEO_PAGES, absoluteUrl, siteJsonLd } from "@/lib/seo";
import { SiteAnalytics } from "@/shared/analytics/site-analytics";
import { YandexMetrikaNoscript } from "@/shared/analytics/yandex-metrika-noscript";
import { CookieConsentBanner } from "@/shared/legal/cookie-consent-banner";
import { SiteFooter } from "@/shared/layout/site-footer";
import { SiteHeader } from "@/shared/layout/site-header";

import "./globals.css";

const metadataBaseUrl = (() => {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3001";
  try {
    return new URL(raw);
  } catch {
    return new URL("http://localhost:3001");
  }
})();

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl,
  title: {
    default: SEO_PAGES.home.title,
    template: "%s | Utrainer",
  },
  description: SEO_PAGES.home.description,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Utrainer",
    title: SEO_PAGES.home.title,
    description: SEO_PAGES.home.description,
    url: absoluteUrl(SEO_PAGES.home.path),
  },
  twitter: {
    card: "summary",
    title: SEO_PAGES.home.title,
    description: SEO_PAGES.home.description,
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
