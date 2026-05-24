"use client";

import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { AdminEventsModerationSection } from "@/features/admin/sections/admin-events-moderation";
import { AdminModerationSection } from "@/features/admin/sections/admin-moderation";

export default function AdminModerationPage() {
  return (
    <AdminWorkspace
      title="Модерация"
      subtitle="Проверка профилей инструкторов, мероприятий и сертификатов перед допуском к работе."
    >
      {(data) => (
        <div className="space-y-6">
          <AdminModerationSection data={data} />
          <AdminEventsModerationSection />
        </div>
      )}
    </AdminWorkspace>
  );
}
