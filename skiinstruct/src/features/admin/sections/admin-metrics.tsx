"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";

import type { AdminOverview } from "@/features/admin/admin-overview-types";
import { adminOverviewHref } from "@/features/admin/admin-search-params";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { cn } from "@/lib/utils";

function MetricCard({
  href,
  title,
  value,
  hint,
}: {
  href: string;
  title: string;
  value: number;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-colors",
        "hover:border-accent/50 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
          <div className="text-3xl font-semibold tabular-nums">{value}</div>
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

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Карточки кликабельны — откроют раздел с полным списком и фильтрами.
      </p>
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard
        href={adminOverviewHref("/admin/orders", { ...preserve, group: "all" })}
        title="Всего заказов"
        value={data.ordersCount}
        hint="Все заказы · фильтры: в работе, ожидание, завершённые"
      />
      <MetricCard
        href={adminOverviewHref("/admin/users", preserve)}
        title="Пользователи"
        value={data.usersCount}
        hint="Клиенты, инструкторы, админы · фильтр «онлайн»"
      />
      <MetricCard
        href={adminOverviewHref("/admin/moderation", preserve)}
        title="Инструкторы на модерации"
        value={data.pendingInstructors}
        hint="Очередь проверки анкет и новых регистраций"
      />
    </div>
    </div>
  );
}
