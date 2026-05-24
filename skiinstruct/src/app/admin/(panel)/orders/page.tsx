"use client";

import { Suspense } from "react";

import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { AdminOrdersDrilldownSection } from "@/features/admin/sections/admin-orders-drilldown";
import { Skeleton } from "@/shared/ui/skeleton";

export default function AdminOrdersPage() {
  return (
    <AdminWorkspace
      title="Заказы"
      subtitle="Выберите заказ «Ожидает ответа инструктора» в таблице → «Отменить ожидание» → в окне: «Передать следующему» или «Снять ожидание». (обновление интерфейса)"
    >
      {(data) => (
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <AdminOrdersDrilldownSection data={data} />
        </Suspense>
      )}
    </AdminWorkspace>
  );
}
