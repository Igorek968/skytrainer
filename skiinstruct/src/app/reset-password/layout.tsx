import type { Metadata } from "next";

import { pageMetadata, SEO_PAGES } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(SEO_PAGES.resetPassword);

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
