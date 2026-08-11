"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { useAdminAlertCounts } from "@/features/admin/admin-alerts-bell";
import type { AdminOverview } from "@/features/admin/admin-overview-types";
import { adminOverviewHref } from "@/features/admin/admin-search-params";
import { useAdminInstructorsFunnel } from "@/features/admin/use-admin-instructors-funnel";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { cn } from "@/lib/utils";

function MetricCard({
  href,
  title,
  value,
  hint,
  warn,
}: {
  href: string;
  title: string;
  value: number;
  hint: string;
  warn?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-lg border bg-card text-card-foreground shadow-sm transition-colors",
        warn
          ? "border-amber-500/50 hover:border-amber-500"
          : "border-border hover:border-accent/50 hover:bg-muted/20",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          <ChevronRight
            className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
            aria-hidden
          />
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "text-3xl font-semibold tabular-nums",
              warn && "text-amber-800 dark:text-amber-300",
            )}
          >
            {value}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function AdminMetricsSection({ data }: { data: AdminOverview }) {
  const params = useSearchParams();
  const preserve = {
    user: params.get("user")?.trim() || params.get("email")?.trim() || null,
    activity: params.get("activity")?.trim() || null,
    participant: params.get("participant")?.trim() || null,
  };
  const { data: alerts } = useAdminAlertCounts();
  const { data: funnel } = useAdminInstructorsFunnel();
  const c = alerts?.counts;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Нужно внимание
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            href={adminOverviewHref("/admin/instructors", preserve)}
            title="Просрочка найма (SLA)"
            value={funnel?.totals.overdue ?? 0}
            hint="Модерация / документы дольше целевого времени"
            warn={(funnel?.totals.overdue ?? 0) > 0}
          />
          <MetricCard
            href={adminOverviewHref("/admin/instructors", preserve)}
            title="Модерация анкет"
            value={funnel?.totals.moderation ?? data.pendingInstructors}
            hint="Новые заявки и правки профиля"
            warn={(funnel?.totals.moderation ?? data.pendingInstructors) > 0}
          />
          <MetricCard
            href={adminOverviewHref("/admin/orders", { ...preserve, group: "pending" })}
            title="Заказы · очередь"
            value={c?.orders ?? 0}
            hint="Просроченный urgent, претензии, failed refund"
            warn={(c?.orders ?? 0) > 0}
          />
          <MetricCard
            href={adminOverviewHref("/admin/messages", preserve)}
            title="Открытые сообщения"
            value={c?.messages ?? 0}
            hint="Support-тикеты без закрытия"
            warn={(c?.messages ?? 0) > 0}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Воронка найма
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            href={adminOverviewHref("/admin/instructors", preserve)}
            title="Документы неполные"
            value={funnel?.totals.docsIncomplete ?? 0}
            hint="Одобрены, но нет полного допуска к оплате"
          />
          <MetricCard
            href={adminOverviewHref("/admin/compliance", preserve)}
            title="Доки на проверке"
            value={funnel?.totals.docsReview ?? c?.compliance ?? 0}
            hint="Загруженные файлы ждут одобрения"
          />
          <MetricCard
            href={adminOverviewHref("/admin/users", { ...preserve, role: "INSTRUCTOR", online: "1" })}
            title="На линии"
            value={funnel?.totals.activeOnline ?? 0}
            hint="Готовы принимать заявки"
          />
          <MetricCard
            href={adminOverviewHref("/admin/finance", preserve)}
            title="Выплаты"
            value={funnel?.totals.payoutPending ?? c?.finance ?? 0}
            hint="Заявки инструкторов / рефералов"
            warn={(funnel?.totals.payoutPending ?? c?.finance ?? 0) > 0}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Спрос и база
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            href={adminOverviewHref("/admin/orders", { ...preserve, group: "all" })}
            title="Всего заказов"
            value={data.ordersCount}
            hint="Все заказы · фильтры в разделе"
          />
          <MetricCard
            href={adminOverviewHref("/admin/pipeline", preserve)}
            title="В работе / ожидание"
            value={
              data.pipeline.onlineQueuePending +
              data.pipeline.flexiblePending +
              data.pipeline.inProgress
            }
            hint="Очередь инструктора + урок"
          />
          <MetricCard
            href={adminOverviewHref("/admin/users", preserve)}
            title="Пользователи"
            value={data.usersCount}
            hint="Клиенты, инструкторы, админы"
          />
        </div>
      </div>
    </div>
  );
}
