"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useInstructorPendingOrderAlerts } from "@/features/instructor/use-instructor-pending-order-alerts";
import {
  instructorRegistrationStatusLabel,
  type InstructorRegistrationListItem,
} from "@/lib/instructor-event-registration";
import { formatEventDateRu } from "@/lib/instructor-events";
import { devPollInterval } from "@/lib/query-poll";
import { orderStatusLabel } from "@/shared/lib/order-status";
import { OrderCancellationSide } from "@/shared/ui/order-cancellation-side";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import type { Order, OrderStatus } from "@prisma/client";

type OrderRow = Order;

type ListEntry =
  | { kind: "lesson"; sortAt: number; order: OrderRow }
  | { kind: "event"; sortAt: number; registration: InstructorRegistrationListItem };

function ClientThumb({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    return (
      <Image
        src={image}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 rounded-full object-cover"
        unoptimized
      />
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
      {(name?.trim() || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

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

  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const r = await fetch("/api/orders");
      if (!r.ok) throw new Error("orders");
      return r.json() as Promise<{ orders: OrderRow[] }>;
    },
    refetchInterval: devPollInterval(5000),
  });

  const registrationsQuery = useQuery({
    queryKey: ["instructor-registrations"],
    queryFn: async () => {
      const r = await fetch("/api/instructor/registrations", { credentials: "include" });
      if (!r.ok) throw new Error("registrations");
      return r.json() as Promise<{ registrations: InstructorRegistrationListItem[] }>;
    },
    refetchInterval: devPollInterval(15_000),
  });

  useInstructorPendingOrderAlerts(ordersQuery.data?.orders);

  const entries = useMemo(() => {
    const items: ListEntry[] = [];
    for (const o of ordersQuery.data?.orders ?? []) {
      items.push({ kind: "lesson", sortAt: new Date(o.createdAt).getTime(), order: o });
    }
    for (const r of registrationsQuery.data?.registrations ?? []) {
      items.push({ kind: "event", sortAt: new Date(r.createdAt).getTime(), registration: r });
    }
    return items.sort((a, b) => b.sortAt - a.sortAt);
  }, [ordersQuery.data?.orders, registrationsQuery.data?.registrations]);

  const isLoading = ordersQuery.isLoading || registrationsQuery.isLoading;
  const error = ordersQuery.error || registrationsQuery.error;

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
            <Link href="/instructor">Профиль и мероприятия</Link>
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
      ) : !entries.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Заказов пока нет</CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => {
            if (entry.kind === "lesson") {
              return (
              <li key={`order-${entry.order.id}`}>
                <Link href={`/instructor/orders/${entry.order.id}`}>
                  <Card className="transition-colors hover:bg-muted/40">
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                      <div>
                        <div className="font-medium">
                          {orderStatusLabel(entry.order.status as OrderStatus)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Урок · {new Date(entry.order.createdAt).toLocaleString("ru-RU")}
                        </div>
                        <OrderCancellationSide
                          status={entry.order.status as OrderStatus}
                          cancelledBy={entry.order.cancelledBy}
                          className="text-xs"
                        />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {entry.order.amountTotal ? `${Number(entry.order.amountTotal)} ₽` : "—"}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
              );
            }
            return (
              <li key={`reg-${entry.registration.id}`}>
                <Link href={`/instructor/registrations/${entry.registration.id}`}>
                  <Card className="transition-colors hover:bg-muted/40">
                    <CardContent className="flex flex-wrap items-center gap-3 py-4">
                      <ClientThumb
                        name={entry.registration.client.name}
                        image={entry.registration.client.image}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">
                          {instructorRegistrationStatusLabel(entry.registration.status)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Мероприятие · {entry.registration.event.title}
                          {entry.registration.event.eventAt
                            ? ` · ${formatEventDateRu(entry.registration.event.eventAt)}`
                            : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {entry.registration.client.name ?? entry.registration.client.email}
                          {entry.registration.client.ratingAvg != null
                            ? ` · ★ ${entry.registration.client.ratingAvg.toFixed(1)}`
                            : ""}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {entry.registration.amountRub > 0
                          ? `${entry.registration.amountRub.toLocaleString("ru-RU")} ₽`
                          : "Бесплатно"}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
