"use client";

import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { AdminActivitySection } from "@/features/admin/sections/admin-activity";

export default function AdminActivityPage() {
  return (
    <AdminWorkspace
      title="Лента действий"
      subtitle="Журнал событий: заказы, регистрации и заявки инструкторов в одной хронологии."
    >
      {(data) => <AdminActivitySection data={data} />}
    </AdminWorkspace>
  );
}
