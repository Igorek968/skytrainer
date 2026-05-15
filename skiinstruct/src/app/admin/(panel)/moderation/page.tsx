"use client";

import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { AdminModerationSection } from "@/features/admin/sections/admin-moderation";

export default function AdminModerationPage() {
  return (
    <AdminWorkspace
      title="Модерация"
      subtitle="Проверка профилей инструкторов и сертификатов перед допуском к работе."
    >
      {(data) => <AdminModerationSection data={data} />}
    </AdminWorkspace>
  );
}
