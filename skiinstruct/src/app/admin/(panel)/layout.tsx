import { AdminPanelShell } from "@/features/admin/admin-panel-shell";
import { redirectToRoleCabinetUnless } from "@/lib/auth-server-redirect";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  await redirectToRoleCabinetUnless(["ADMIN", "MODERATOR"], "/admin/login");
  return <AdminPanelShell>{children}</AdminPanelShell>;
}
