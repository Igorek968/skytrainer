"use client";

import type { AdminOverview } from "@/features/admin/admin-overview-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export function AdminPipelineSection({ data }: { data: AdminOverview }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Мониторинг заказов</CardTitle>
        <CardDescription>Где сейчас «висят» заявки и что в работе.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-xs font-medium text-muted-foreground">Срочные заявки</div>
          <div className="text-2xl font-semibold">{data.pipeline.onlineQueuePending}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            PENDING_INSTRUCTOR, таймер ответа, не «запись на дату».
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-xs font-medium text-muted-foreground">Запись на дату (офлайн)</div>
          <div className="text-2xl font-semibold">{data.pipeline.flexiblePending}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Ожидание ответа без таймера после оплаты.</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-xs font-medium text-muted-foreground">В работе (урок)</div>
          <div className="text-2xl font-semibold">{data.pipeline.inProgress}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Принято, в пути, урок начался.</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-xs font-medium text-muted-foreground">Ожидают оплаты</div>
          <div className="text-2xl font-semibold">{data.pipeline.awaitingPayment}</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-xs font-medium text-muted-foreground">Черновики</div>
          <div className="text-2xl font-semibold">{data.pipeline.draftOrders}</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-xs font-medium text-muted-foreground">Завершено за 30 дней</div>
          <div className="text-2xl font-semibold">{data.pipeline.completedLast30d}</div>
        </div>
      </CardContent>
    </Card>
  );
}
