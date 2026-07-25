"use client";

import Link from "next/link";

import type { AdminOverview } from "@/features/admin/admin-overview-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

function PipelineLink({
  href,
  title,
  value,
  hint,
}: {
  href: string;
  title: string;
  value: number;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:border-accent hover:bg-accent/10"
    >
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
      <p className="mt-2 text-[11px] font-medium text-accent">Открыть заказы →</p>
    </Link>
  );
}

export function AdminPipelineSection({ data }: { data: AdminOverview }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Мониторинг заказов</CardTitle>
        <CardDescription>Клик по карточке — фильтр в разделе «Заказы».</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <PipelineLink
          href="/admin/orders?status=PENDING_INSTRUCTOR"
          title="Срочные / ожидание инструктора"
          value={data.pipeline.onlineQueuePending}
          hint="PENDING_INSTRUCTOR (в т.ч. срочные)."
        />
        <PipelineLink
          href="/admin/orders?status=PENDING_INSTRUCTOR"
          title="Запись на дату (офлайн)"
          value={data.pipeline.flexiblePending}
          hint="Ожидание ответа без таймера после оплаты."
        />
        <PipelineLink
          href="/admin/orders?group=in_progress"
          title="В работе (урок)"
          value={data.pipeline.inProgress}
          hint="Принято, в пути, урок начался."
        />
        <PipelineLink
          href="/admin/orders?status=AWAITING_PAYMENT"
          title="Ожидают оплаты"
          value={data.pipeline.awaitingPayment}
        />
        <PipelineLink
          href="/admin/orders?status=DRAFT"
          title="Черновики"
          value={data.pipeline.draftOrders}
        />
        <PipelineLink
          href="/admin/orders?status=COMPLETED"
          title="Завершено (счётчик 30 дн.)"
          value={data.pipeline.completedLast30d}
        />
      </CardContent>
    </Card>
  );
}
