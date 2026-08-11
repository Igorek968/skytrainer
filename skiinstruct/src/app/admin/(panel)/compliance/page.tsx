"use client";

import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { AdminComplianceSection } from "@/features/admin/sections/admin-compliance";

export default function AdminCompliancePage() {
  return (
    <AdminWorkspace
      title="ЮKassa / договоры"
      subtitle="Документы НПД/ИП/паспорт, претензии, пакет для ЮKassa. Связано с воронкой инструкторов."
    >
      {() => <AdminComplianceSection />}
    </AdminWorkspace>
  );
}
