import type { Metadata } from "next";

import { getPublicProductName } from "@/shared/lib/product";

const productName = getPublicProductName();

export const metadata: Metadata = {
  title: {
    default: `Кабинет инструктора · ${productName}`,
    template: `%s · ${productName}`,
  },
};

/** /instructor/login и /instructor/apply — без проверки сессии (см. (panel)/layout). */
export default function InstructorSegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
