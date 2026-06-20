import type { Metadata } from "next";

import ClientHomePage from "@/app/client/client-home";
import { pageMetadata, SEO_PAGES } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(SEO_PAGES.clientSearch);

export default function ClientSearchPage() {
  return <ClientHomePage />;
}
