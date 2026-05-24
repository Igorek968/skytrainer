"use client";

import { Suspense } from "react";

import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { AdminMetricsSection } from "@/features/admin/sections/admin-metrics";
import { Skeleton } from "@/shared/ui/skeleton";

function MetricsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export default function AdminMetricsPage() {
  return (
    <AdminWorkspace
      title="Показатели"
      subtitle="Нажмите на карточку счётчика — откроется список заказов, пользователей или очередь модерации."
    >
      {(data) => (
        <Suspense fallback={<MetricsSkeleton />}>
          <AdminMetricsSection data={data} />
        </Suspense>
      )}
    </AdminWorkspace>
  );
}
