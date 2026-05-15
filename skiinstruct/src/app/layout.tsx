import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { AppProviders } from "@/app/providers";
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.variable} min-h-dvh font-sans`}>
        <AppProviders>
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
          <SiteFooter />
        </AppProviders>
      </body>
    </html>
  );
}
