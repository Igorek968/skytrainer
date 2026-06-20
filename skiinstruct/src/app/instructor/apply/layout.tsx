import type { Metadata } from "next";

import { pageMetadata, SEO_PAGES } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(SEO_PAGES.instructorApply);

export default function InstructorApplyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
