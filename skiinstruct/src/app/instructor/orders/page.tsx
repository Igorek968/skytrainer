"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useInstructorPendingOrderAlerts } from "@/features/instructor/use-instructor-pending-order-alerts";
import { orderStatusLabel } from "@/shared/lib/order-status";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import type { Order, OrderStatus } from "@prisma/client";

type OrderRow = Order;

export default function InstructorOrdersPage() {
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(Notification.permission);
  }, []);
  const { data, isLoading, error } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const r = await fetch("/api/orders");
      if (!r.ok) throw new Error("orders");
      return r.json() as Promise<{ orders: OrderRow[] }>;
    },
    refetchInterval: 5000,
  });

  useInstructorPendingOrderAlerts(data?.orders);

  const requestNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotificationPermission(perm);
    if (perm === "granted") toast.success("Браузерные уведомления включены");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Заказы</h1>
        <div className="flex items-center gap-2">
          {notificationPermission !== "unsupported" && notificationPermission !== "granted" ? (
            <Button type="button" variant="outline" onClick={requestNotifications}>
              Включить уведомления
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/instructor">Настройки</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">Не удалось загрузить</p>
      ) : !data?.orders.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Заказов пока нет</CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <ul className="space-y-3">
          {data.orders.map((o) => (
            <li key={o.id}>
              <Link href={`/instructor/orders/${o.id}`}>
                <Card className="transition-colors hover:bg-muted/40">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <div className="font-medium">{orderStatusLabel(o.status as OrderStatus)}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.createdAt).toLocaleString("ru-RU")}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {o.amountTotal ? `${Number(o.amountTotal)} ₽` : "—"}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
