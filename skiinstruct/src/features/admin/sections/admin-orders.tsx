"use client";

import type { AdminOverview } from "@/features/admin/admin-overview-types";
import { adminMoney, adminOrderFlowLabel } from "@/features/admin/admin-overview-types";
import { orderStatusLabel } from "@/shared/lib/order-status";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import type { OrderStatus } from "@prisma/client";

export function AdminOrdersSection({ data }: { data: AdminOverview }) {
  const statusEntries = Object.entries(data.ordersByStatus).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Заказы по статусам</CardTitle>
          <CardDescription>Сводка по enum OrderStatus.</CardDescription>
        </CardHeader>
        <CardContent>
          {statusEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет данных</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {statusEntries.map(([status, count]) => (
                <Badge key={status} variant="outline" className="gap-1.5 px-2 py-1 text-xs font-normal">
                  <span>{orderStatusLabel(status as OrderStatus)}</span>
                  <span className="font-semibold text-foreground">{count}</span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Последние действия по заказам</CardTitle>
          <CardDescription>40 последних обновлений (по времени изменения).</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Обновлён</th>
                <th className="py-2 pr-3 font-medium">ID</th>
                <th className="py-2 pr-3 font-medium">Клиент</th>
                <th className="py-2 pr-3 font-medium">Инструктор</th>
                <th className="py-2 pr-3 font-medium">Статус</th>
                <th className="py-2 pr-3 font-medium">Поток</th>
                <th className="py-2 pr-3 font-medium">Сумма</th>
                <th className="py-2 font-medium">Оплата</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((o) => (
                <tr key={o.id} className="border-b border-border/80">
                  <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                    {new Date(o.updatedAt).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{o.id.slice(0, 8)}…</td>
                  <td className="py-2 pr-3">
                    <div className="max-w-[140px] truncate font-medium">{o.clientName ?? "—"}</div>
                    <div className="max-w-[160px] truncate text-xs text-muted-foreground">{o.clientEmail}</div>
                  </td>
                  <td className="py-2 pr-3 max-w-[120px] truncate">{o.instructorName ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <Badge variant="secondary" className="text-[10px]">
                      {orderStatusLabel(o.status)}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{adminOrderFlowLabel(o)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{o.amountTotal != null ? adminMoney(o.amountTotal) : "—"}</td>
                  <td className="py-2 text-xs">{o.paymentStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
