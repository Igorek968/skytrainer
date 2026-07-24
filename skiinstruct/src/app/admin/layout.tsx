import type { Metadata } from "next";

import { getPublicProductName } from "@/shared/lib/product";

const productName = getPublicProductName();

/** Весь раздел /admin относится к приложению ТвойТренер.рф (этот репозиторий Next.js). */
export const metadata: Metadata = {
  title: {
    default: `Администрирование · ${productName}`,
    template: `%s · ${productName} Admin`,
  },
  robots: { index: false, follow: false },
};

export default function AdminSegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
