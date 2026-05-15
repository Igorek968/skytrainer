"use client";

import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { AdminOrdersSection } from "@/features/admin/sections/admin-orders";

export default function AdminOrdersPage() {
  return (
    <AdminWorkspace
      title="Заказы"
      subtitle="Распределение по статусам и последние обновления по заказам."
    >
      {(data) => <AdminOrdersSection data={data} />}
    </AdminWorkspace>
  );
}
