"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";
import { toast } from "sonner";

import {
  clientRegistrationListTitle,
  clientRegistrationStatusLabel,
  type ClientRegistrationListItem,
} from "@/lib/client-event-registration";
import { clientCanRemoveOrderFromHistory, orderStatusLabel } from "@/shared/lib/order-status";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import type { Order, OrderStatus } from "@prisma/client";

type OrderRow = Order & {
  resort: { name: string } | null;
};

type ListEntry =
  | { kind: "lesson"; sortAt: number; order: OrderRow }
  | { kind: "event"; sortAt: number; registration: ClientRegistrationListItem };

export default function ClientOrdersPage() {
  const qc = useQueryClient();

  const removeFromHistory = useMutation({
    mutationFn: async (orderId: string) => {
      const r = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(typeof j.error === "string" ? j.error : "delete");
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Заказ удалён из истории");
    },
    onError: (e: Error) => toast.error(e.message || "Не удалось удалить"),
  });

  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const r = await fetch("/api/orders");
      if (!r.ok) throw new Error("orders");
      return r.json() as Promise<{ orders: OrderRow[] }>;
    },
  });

  const registrationsQuery = useQuery({
    queryKey: ["client-registrations"],
    queryFn: async () => {
      const r = await fetch("/api/client/registrations", { credentials: "include" });
      if (!r.ok) throw new Error("registrations");
      return r.json() as Promise<{ registrations: ClientRegistrationListItem[] }>;
    },
  });

  const isLoading = ordersQuery.isLoading || registrationsQuery.isLoading;
  const error = ordersQuery.error || registrationsQuery.error;

  const entries = useMemo(() => {
    const items: ListEntry[] = [];
    for (const o of ordersQuery.data?.orders ?? []) {
      items.push({
        kind: "lesson",
        sortAt: new Date(o.createdAt).getTime(),
        order: o,
      });
    }
    for (const r of registrationsQuery.data?.registrations ?? []) {
      items.push({
        kind: "event",
        sortAt: new Date(r.createdAt).getTime(),
        registration: r,
      });
    }
    return items.sort((a, b) => b.sortAt - a.sortAt);
  }, [ordersQuery.data?.orders, registrationsQuery.data?.registrations]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Мои заказы</h1>
        <Button asChild variant="accent">
          <Link href="/client">Новый заказ</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">Не удалось загрузить заказы</p>
      ) : !entries.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Пока пусто</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/client">Создать заказ</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) =>
            entry.kind === "lesson" ? (
              <li key={`order-${entry.order.id}`}>
                <Card className="transition-colors hover:bg-muted/40">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <Link
                      href={`/client/orders/${entry.order.id}`}
                      className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">
                          {orderStatusLabel(entry.order.status as OrderStatus)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Урок · {new Date(entry.order.createdAt).toLocaleString("ru-RU")} ·{" "}
                          {entry.order.resort?.name ?? "Курорт"}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {entry.order.amountTotal ? `${Number(entry.order.amountTotal)} ₽` : "—"}
                      </div>
                    </Link>
                    {clientCanRemoveOrderFromHistory(entry.order.status as OrderStatus) ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={removeFromHistory.isPending}
                        onClick={() => {
                          if (
                            !confirm(
                              "Удалить заказ из истории? Данные заказа будут удалены без возможности восстановления.",
                            )
                          ) {
                            return;
                          }
                          removeFromHistory.mutate(entry.order.id);
                        }}
                      >
                        Удалить из истории
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ) : (
              <li key={`reg-${entry.registration.id}`}>
                <Card className="transition-colors hover:bg-muted/40">
                  <CardContent className="py-4">
                    <Link
                      href={`/client/registrations/${entry.registration.id}`}
                      className="flex min-w-0 flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">
                          {clientRegistrationStatusLabel(entry.registration.status)}
                        </div>
                        <div className="line-clamp-2 text-xs text-muted-foreground">
                          Мероприятие · {clientRegistrationListTitle(entry.registration)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(entry.registration.createdAt).toLocaleString("ru-RU")}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {entry.registration.amountRub > 0
                          ? `${entry.registration.amountRub.toLocaleString("ru-RU")} ₽`
                          : "Бесплатно"}
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
