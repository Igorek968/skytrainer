import { redirectToRoleCabinetUnless } from "@/lib/auth-server-redirect";
import { clientAuthLoginRedirect } from "@/lib/role-route-access";

/** Список и карточки заказов — только для роли CLIENT. */
export default async function ClientOrdersLayout({ children }: { children: React.ReactNode }) {
  await redirectToRoleCabinetUnless("CLIENT", clientAuthLoginRedirect("/client/orders"));
  return children;
}
