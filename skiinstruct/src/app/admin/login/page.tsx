import { redirectWhenAlreadyLoggedIn } from "@/lib/auth-server-redirect";

import { AdminLoginForm } from "./admin-login-form";

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
