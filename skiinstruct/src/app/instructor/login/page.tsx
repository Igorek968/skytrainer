import type { Metadata } from "next";

import { redirectWhenAlreadyLoggedIn } from "@/lib/auth-server-redirect";
import { pageMetadata, SEO_PAGES } from "@/lib/seo";

import { InstructorLoginForm } from "./instructor-login-form";

export const metadata: Metadata = pageMetadata(SEO_PAGES.instructorLogin);

type SearchParams = Record<string, string | string[] | undefined>;

export default async function InstructorLoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : null;
  await redirectWhenAlreadyLoggedIn("INSTRUCTOR", callbackUrl);

  const applied = params.applied === "1";
  const prefilledEmail = typeof params.email === "string" ? params.email.trim() : "";
  const signInRequired = params.signin === "required";

  return (
    <InstructorLoginForm
      applied={applied}
      prefilledEmail={prefilledEmail}
      signInRequired={signInRequired}
      callbackUrl={callbackUrl ?? "/instructor/pending"}
    />
  );
}
