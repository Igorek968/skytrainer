"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { useAdminAlertCounts } from "@/features/admin/admin-alerts-bell";
import type { AdminOverview } from "@/features/admin/admin-overview-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { cn } from "@/lib/utils";

function PipelineLink({
  href,
  title,
  value,
  hint,
  warn,
}: {
  href: string;
  title: string;
  value: number;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg border p-3 transition-colors",
        warn
          ? "border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/15"
          : "border-border bg-muted/30 hover:border-accent hover:bg-accent/10",
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {warn ? <AlertTriangle className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" aria-hidden /> : null}
        {title}
      </div>
      <div
        className={cn(
          "text-2xl font-semibold tabular-nums",
          warn && "text-amber-900 dark:text-amber-200",
        )}
      >
        {value}
      </div>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
      <p className="mt-2 text-[11px] font-medium text-accent">Открыть заказы →</p>
    </Link>
  );
}

export function AdminPipelineSection({ data }: { data: AdminOverview }) {
  const { data: alerts } = useAdminAlertCounts();
  const attention = alerts?.counts?.orders ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Нужно внимание</CardTitle>
          <CardDescription>
            Просроченный urgent, претензии по качеству (7 дн.), неудачные возвраты — вмешательство админа.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <PipelineLink
            href="/admin/orders?status=PENDING_INSTRUCTOR"
            title="Rescue / очередь инструктора"
            value={data.pipeline.onlineQueuePending + data.pipeline.flexiblePending}
            hint="Срочные и запись на дату — проверить просрочки таймера."
            warn={attention > 0 || data.pipeline.onlineQueuePending > 0}
          />
          <PipelineLink
            href="/admin/orders?group=pending"
            title="Сигналы по заказам"
            value={attention}
            hint="Счётчик алертов: overdue urgent + claims + failed refund."
            warn={attention > 0}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Воронка заказов</CardTitle>
          <CardDescription>Клик по карточке — фильтр в разделе «Заказы».</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <PipelineLink
            href="/admin/orders?status=DRAFT"
            title="Черновики / abandoned"
            value={data.pipeline.draftOrders}
            hint="Не завершили оформление."
          />
          <PipelineLink
            href="/admin/orders?status=AWAITING_PAYMENT"
            title="Ожидают оплаты"
            value={data.pipeline.awaitingPayment}
          />
          <PipelineLink
            href="/admin/orders?status=PENDING_INSTRUCTOR"
            title="Matching · срочные"
            value={data.pipeline.onlineQueuePending}
            hint="PENDING_INSTRUCTOR с таймером / очередью."
          />
          <PipelineLink
            href="/admin/orders?status=PENDING_INSTRUCTOR"
            title="Matching · на дату"
            value={data.pipeline.flexiblePending}
            hint="Гибкое приглашение без срочного таймера."
          />
          <PipelineLink
            href="/admin/orders?group=in_progress"
            title="В работе (урок)"
            value={data.pipeline.inProgress}
            hint="Принято, в пути, урок начался."
          />
          <PipelineLink
            href="/admin/orders?status=COMPLETED"
            title="Завершено (30 дн.)"
            value={data.pipeline.completedLast30d}
          />
          <PipelineLink
            href="/admin/pipeline#force-majeure"
            title="Форс-мажор · отменено"
            value={data.pipeline.forceMajeureLast30d ?? 0}
            hint="События: полный возврат, причина отмены у каждой записи."
            warn={(data.pipeline.forceMajeureLast30d ?? 0) > 0}
          />
        </CardContent>
      </Card>

      {(data.forceMajeureRecent?.length ?? 0) > 0 ? (
        <Card id="force-majeure">
          <CardHeader>
            <CardTitle className="text-base">Форс-мажор (события)</CardTitle>
            <CardDescription>
              Отмены после начала с полным возвратом. Причина прикреплена к каждой записи участника.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.forceMajeureRecent.map((row) => (
              <div key={row.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="font-medium text-foreground">{row.title}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.instructorName}
                  {row.forceMajeureAt
                    ? ` · ${new Date(row.forceMajeureAt).toLocaleString("ru-RU")}`
                    : ""}
                </p>
                <p className="mt-2 text-amber-900 dark:text-amber-100">
                  Причина: {row.forceMajeureReason ?? "—"}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {row.registrations.map((r) => (
                    <li key={r.id}>
                      {r.clientLabel} · {r.amountRub.toLocaleString("ru-RU")} ₽ · отменено
                      {r.cancelReason ? ` · ${r.cancelReason}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
