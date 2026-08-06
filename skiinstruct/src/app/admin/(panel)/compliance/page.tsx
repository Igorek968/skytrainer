"use client";

import { AdminComplianceSection } from "@/features/admin/sections/admin-compliance";

export default function AdminCompliancePage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">ЮKassa / договоры</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Претензии по качеству, договоры с инструкторами и клиентами, проверка НПД/ИП, пакет для ЮKassa.
        </p>
      </header>
      <AdminComplianceSection />
    </div>
  );
}
