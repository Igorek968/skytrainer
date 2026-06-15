"use client";

import type { AdminOverview } from "@/features/admin/admin-overview-types";
import { adminActivityCategoryLabel } from "@/features/admin/admin-overview-types";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { getPublicProductName } from "@/shared/lib/product";

export function AdminActivitySection({ data }: { data: AdminOverview }) {
  const productName = getPublicProductName();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Лента событий {productName}</CardTitle>
        <CardDescription>
          Журнал в реальном времени по данным приложения: заказы (создание и изменения), регистрации, модерация
          инструкторов и сообщения в чатах заказов.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.activityFeed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет событий</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {data.activityFeed.map((item) => (
              <li key={item.id} className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
                <time className="shrink-0 text-xs tabular-nums text-muted-foreground sm:w-36" dateTime={item.at}>
                  {new Date(item.at).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </time>
                <Badge variant="outline" className="w-fit max-w-[10rem] truncate text-[10px] font-normal sm:hidden">
                  {item.eventLabel}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="hidden text-[10px] font-normal sm:inline-flex">
                      {adminActivityCategoryLabel(item.category)}
                    </Badge>
                    <Badge variant="outline" className="hidden text-[10px] font-normal sm:inline-flex">
                      {item.eventLabel}
                    </Badge>
                    <span className="text-sm font-medium leading-snug">{item.summary}</span>
                  </div>
                  {item.meta ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground sm:whitespace-normal sm:break-words">
                      {item.meta}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
