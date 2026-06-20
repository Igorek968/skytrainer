import type { Metadata } from "next";

import { pageMetadata, SEO_PAGES } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(SEO_PAGES.clientRegister);

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
