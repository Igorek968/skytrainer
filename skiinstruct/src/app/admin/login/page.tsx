import type { Metadata } from "next";

import { redirectWhenAlreadyLoggedIn } from "@/lib/auth-server-redirect";
import { pageMetadata, SEO_PAGES } from "@/lib/seo";

import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = pageMetadata(SEO_PAGES.adminLogin);

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : null;
  await redirectWhenAlreadyLoggedIn("ADMIN", callbackUrl);

  return <AdminLoginForm callbackUrl={callbackUrl ?? "/admin/moderation"} />;
}
