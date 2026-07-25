"use client";

import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { AdminActivitySection } from "@/features/admin/sections/admin-activity";
import { AdminAuditLogSection } from "@/features/admin/sections/admin-audit-log";

export default function AdminActivityPage() {
  return (
    <AdminWorkspace
      title="Лента действий"
      subtitle="Журнал событий: заказы, регистрации и заявки инструкторов в одной хронологии."
    >
      {(data) => (
        <div className="space-y-6">
          <AdminActivitySection data={data} />
          <AdminAuditLogSection />
        </div>
      )}
    </AdminWorkspace>
  );
}
