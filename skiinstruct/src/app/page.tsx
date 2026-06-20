import type { Metadata } from "next";
import { Suspense } from "react";

import ClientHomePage from "@/app/client/client-home";
import { pageMetadata, SEO_PAGES } from "@/lib/seo";
import { Skeleton } from "@/shared/ui/skeleton";

function ClientHomeFallback() {
  return (
    <div className="space-y-6" aria-busy aria-label="Загрузка…">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-[320px] w-full rounded-lg md:h-[420px]" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

export const metadata: Metadata = pageMetadata(SEO_PAGES.home);

/** Главная = поиск и заказ на карте; кабинеты — по ссылкам в шапке. */
export default function HomePage() {
  return (
    <Suspense fallback={<ClientHomeFallback />}>
      <ClientHomePage />
    </Suspense>
  );
}
