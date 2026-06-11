import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { auth } from "@/auth";
import { AppProviders } from "@/app/providers";
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
  title: "Инструктор для тебя — заказ урока на курорте",
  description: "Заказ инструктора по лыжам и сноуборду на горнолыжном курорте",
  manifest: "/manifest.webmanifest",
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

  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.variable} min-h-dvh font-sans`}>
        <AppProviders session={session}>
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-6">
            {children}
          </main>
          <SiteFooter />
          <CookieConsentBanner />
        </AppProviders>
      </body>
    </html>
  );
}
