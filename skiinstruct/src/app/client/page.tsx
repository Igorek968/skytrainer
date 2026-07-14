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
    </div>
  );
}

/** Старый URL /client: тот же UI, canonical на главную `/`. */
export const metadata: Metadata = {
  ...pageMetadata(SEO_PAGES.home),
  robots: { index: false, follow: true },
};

export default function ClientSearchPage() {
  return (
    <Suspense fallback={<ClientHomeFallback />}>
      <ClientHomePage />
    </Suspense>
  );
}
