import { redirectWhenAlreadyLoggedIn } from "@/lib/auth-server-redirect";

import { ClientLoginForm } from "./client-login-form";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : null;
  await redirectWhenAlreadyLoggedIn("CLIENT", callbackUrl);

  return <ClientLoginForm />;
}
