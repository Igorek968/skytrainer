import type { Metadata } from "next";

import { pageMetadata, SEO_PAGES } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(SEO_PAGES.support);

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
