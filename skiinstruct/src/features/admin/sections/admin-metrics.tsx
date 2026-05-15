"use client";

import type { AdminOverview } from "@/features/admin/admin-overview-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export function AdminMetricsSection({ data }: { data: AdminOverview }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Всего заказов</CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">{data.ordersCount}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Пользователи</CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">{data.usersCount}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Инструкторы на модерации</CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">{data.pendingInstructors}</CardContent>
      </Card>
    </div>
  );
}
