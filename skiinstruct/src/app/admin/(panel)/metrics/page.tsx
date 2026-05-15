"use client";

import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { AdminMetricsSection } from "@/features/admin/sections/admin-metrics";

export default function AdminMetricsPage() {
  return (
    <AdminWorkspace
      title="Показатели"
      subtitle="Ключевые счётчики: заказы, пользователи и очередь модерации инструкторов."
    >
      {(data) => <AdminMetricsSection data={data} />}
    </AdminWorkspace>
  );
}
