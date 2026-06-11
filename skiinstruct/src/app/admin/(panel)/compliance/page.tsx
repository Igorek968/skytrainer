"use client";

import { AdminComplianceSection } from "@/features/admin/sections/admin-compliance";

export default function AdminCompliancePage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Агентский договор и документы</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Претензии по качеству уроков, реестр акцептов оферты, проверка НПД/ИП и страхования, пакет для ЮKassa.
        </p>
      </header>
      <AdminComplianceSection />
    </div>
  );
}
