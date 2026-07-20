"use client";

import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { AdminEventsModerationSection } from "@/features/admin/sections/admin-events-moderation";
import { AdminModerationSection } from "@/features/admin/sections/admin-moderation";

export default function AdminModerationPage() {
  return (
    <div className="space-y-6">
      <AdminWorkspace
        title="Модерация"
        subtitle="Проверка профилей инструкторов и сертификатов перед допуском к работе."
      >
        {(data) => <AdminModerationSection data={data} />}
      </AdminWorkspace>
      {/* Не зависит от /api/admin/overview — очередь мероприятий доступна даже при сбое сводки. */}
      <AdminEventsModerationSection />
      <p className="text-sm text-muted-foreground">
        Группировка одинаковых туров и снятие с публикации — в разделе{" "}
        <a href="/admin/event-catalog" className="font-medium text-accent underline">
          Каталог
        </a>
        .
      </p>
    </div>
  );
}
