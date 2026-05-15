import { AdminPanelShell } from "@/features/admin/admin-panel-shell";

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return <AdminPanelShell>{children}</AdminPanelShell>;
}
