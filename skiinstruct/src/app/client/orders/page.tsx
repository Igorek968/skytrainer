"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import { clientCanRemoveOrderFromHistory, orderStatusLabel } from "@/shared/lib/order-status";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import type { Order, OrderStatus } from "@prisma/client";

type OrderRow = Order & {
  resort: { name: string } | null;
};

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

  const { data, isLoading, error } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const r = await fetch("/api/orders");
      if (!r.ok) throw new Error("orders");
      return r.json() as Promise<{ orders: OrderRow[] }>;
    },
  });

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
      ) : !data?.orders.length ? (
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
          {data.orders.map((o) => (
            <li key={o.id}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <Link
                    href={`/client/orders/${o.id}`}
                    className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{orderStatusLabel(o.status as OrderStatus)}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.createdAt).toLocaleString("ru-RU")} · {o.resort?.name ?? "Курорт"}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {o.amountTotal ? `${Number(o.amountTotal)} ₽` : "—"}
                    </div>
                  </Link>
                  {clientCanRemoveOrderFromHistory(o.status as OrderStatus) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={removeFromHistory.isPending}
                      onClick={() => {
                        if (
                          !confirm(
                            "Удалить заказ из истории? Данные заказа будут удалены без возможности восстановления."
                          )
                        ) {
                          return;
                        }
                        removeFromHistory.mutate(o.id);
                      }}
                    >
                      Удалить из истории
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
