import { redirectToRoleCabinetUnless } from "@/lib/auth-server-redirect";
import { clientAuthLoginRedirect } from "@/lib/role-route-access";

/** Заявки на события — только для роли CLIENT. */
export default async function ClientRegistrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await redirectToRoleCabinetUnless("CLIENT", clientAuthLoginRedirect("/client/registrations"));
  return children;
}
