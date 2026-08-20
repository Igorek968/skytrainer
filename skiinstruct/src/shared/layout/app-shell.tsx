"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SiteFooter } from "@/shared/layout/site-footer";
import { SiteHeader } from "@/shared/layout/site-header";
import { MessengerWidgets } from "@/shared/marketing/messenger-widgets";

/** Рекламные лендинги без шапки/подвала/виджетов — отдельная «посадочная» оболочка. */
export function isBareMarketingLandingPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const bare = pathname.replace(/\/+$/, "") || "/";
  return bare.startsWith("/landings/");
}

/**
 * Оболочка сайта: на `/landings/*` — без chrome, полноэкранный лендинг.
 * Cookie-баннер и аналитика остаются в root layout.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = isBareMarketingLandingPath(pathname);

  if (bare) {
    return <div className="min-h-dvh w-full">{children}</div>;
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-6">
        {children}
      </main>
      <SiteFooter />
      <MessengerWidgets />
    </>
  );
}
