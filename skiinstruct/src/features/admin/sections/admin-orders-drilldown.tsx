"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { OrderStatus } from "@prisma/client";

import { AdminOrderDetailSheet } from "@/features/admin/admin-order-detail-sheet";
import type { AdminOverview } from "@/features/admin/admin-overview-types";
import { adminMoney, adminOrderFlowLabel } from "@/features/admin/admin-overview-types";
import { adminOverviewHref } from "@/features/admin/admin-search-params";
import { useAdminOrdersListFromUrl } from "@/features/admin/use-admin-orders-list";
import {
  useAdminResetOrderPendingMutation,
  type AdminPendingOrderAction,
} from "@/features/admin/use-admin-reset-order-pending";
import {
  ADMIN_ORDER_GROUP_LABELS,
  parseAdminOrderGroup,
  type AdminOrderGroup,
} from "@/lib/admin-list-filters";
import { formatInAppTimeZone } from "@/shared/lib/app-timezone";
import { orderStatusLabel } from "@/shared/lib/order-status";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/shared/ui/skeleton";

function FilterChip({
  active,
  href,
  label,
  count,
}: {
  active: boolean;
  href: string;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
      {count != null ? <span className={cn("text-xs", active ? "opacity-90" : "opacity-70")}>{count}</span> : null}
    </Link>
  );
}

function OrdersTable({
  orders,
  selectedOrderId,
  onSelect,
  onOpenDetail,
}: {
  orders: AdminOverview["recentOrders"];
  selectedOrderId: string | null;
  onSelect: (orderId: string) => void;
  onOpenDetail: (orderId: string) => void;
}) {
  if (!orders.length) {
    return <p className="text-sm text-muted-foreground">Нет заказов в этой выборке.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="w-10 py-2 pr-2 font-medium" aria-label="Выбор" />
            <th className="py-2 pr-3 font-medium">Обновлён</th>
            <th className="py-2 pr-3 font-medium">ID</th>
            <th className="py-2 pr-3 font-medium">Клиент</th>
            <th className="py-2 pr-3 font-medium">Инструктор</th>
            <th className="py-2 pr-3 font-medium">Статус</th>
            <th className="py-2 pr-3 font-medium">Поток</th>
            <th className="py-2 pr-3 font-medium">Сумма</th>
            <th className="py-2 pr-3 font-medium">Оплата</th>
            <th className="py-2 font-medium">Карточка</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const canSelect = o.status === "PENDING_INSTRUCTOR";
            const selected = selectedOrderId === o.id;
            return (
              <tr
                key={o.id}
                className={cn(
                  "border-b border-border/80 transition-colors",
                  canSelect && "cursor-pointer hover:bg-muted/40",
                  selected && "bg-accent/10 ring-1 ring-inset ring-accent/40",
                )}
                onClick={() => {
                  if (canSelect) onSelect(o.id);
                }}
              >
                <td className="py-2 pr-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="radio"
                    name="admin-order-pick"
                    className="h-4 w-4 accent-[hsl(var(--accent))]"
                    checked={selected}
                    disabled={!canSelect}
                    onChange={() => onSelect(o.id)}
                    aria-label={`Выбрать заказ ${o.id}`}
                  />
                </td>
                <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                  {formatInAppTimeZone(o.updatedAt, {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-2 pr-3 font-mono text-xs">{o.id.slice(0, 8)}…</td>
                <td className="py-2 pr-3">
                  <div className="max-w-[140px] truncate font-medium">{o.clientName ?? "—"}</div>
                  <div className="max-w-[160px] truncate text-xs text-muted-foreground">{o.clientEmail}</div>
                </td>
                <td className="py-2 pr-3 max-w-[120px] truncate">{o.instructorName ?? "—"}</td>
                <td className="py-2 pr-3">
                  <Badge variant="secondary" className="text-[10px]">
                    {orderStatusLabel(o.status)}
                  </Badge>
                </td>
                <td className="py-2 pr-3 text-xs text-muted-foreground">{adminOrderFlowLabel(o)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {o.amountTotal != null ? adminMoney(o.amountTotal) : "—"}
                </td>
                <td className="py-2 pr-3 text-xs">{o.paymentStatus}</td>
                <td className="py-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onOpenDetail(o.id)}
                  >
                    Открыть
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PendingOrderActionModal({
  order,
  pending,
  onClose,
  onAction,
}: {
  order: AdminOverview["recentOrders"][number];
  pending: boolean;
  onClose: () => void;
  onAction: (action: AdminPendingOrderAction) => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pending-order-action-title"
      onClick={() => {
        if (!pending) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pending-order-action-title" className="text-lg font-semibold">
          Что сделать с ожиданием?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Клиент: <span className="font-medium text-foreground">{order.clientName ?? "—"}</span>
          {order.clientEmail ? <> · {order.clientEmail}</> : null}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Инструктор сейчас: <span className="text-foreground">{order.instructorName ?? "—"}</span>
          <span className="mx-2 text-muted-foreground">·</span>
          <span className="font-mono text-xs">{order.id.slice(0, 12)}…</span>
        </p>

        <div className="mt-4 space-y-2">
          <Button
            type="button"
            variant="accent"
            className="h-auto w-full justify-start whitespace-normal py-3 text-left"
            disabled={pending}
            onClick={() => onAction("next_instructor")}
          >
            <span className="block font-semibold">Закрыть ожидание ответа</span>
            <span className="mt-0.5 block text-xs font-normal opacity-90">
              Статус «Не удалось назначить инструктора»; при оплате — полный возврат. Другим не передаётся.
            </span>
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-auto w-full justify-start whitespace-normal py-3 text-left"
            disabled={pending}
            onClick={() => onAction("cancel_waiting")}
          >
            <span className="block font-semibold">Снять ожидание</span>
            <span className="mt-0.5 block text-xs font-normal opacity-90">
              То же, что «Закрыть ожидание»: EXPIRED и возврат при оплате.
            </span>
          </Button>
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AdminOrdersDrilldownSection({ data }: { data: AdminOverview }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const focusUser = params.get("user")?.trim() || params.get("email")?.trim() || null;
  const focusActivity = params.get("activity")?.trim() || null;
  const focusParticipant = params.get("participant")?.trim() || null;
  const qParam = params.get("q")?.trim() || "";

  const group = parseAdminOrderGroup(params.get("group"));
  const statusRaw = params.get("status")?.trim() ?? "";
  const status =
    statusRaw && Object.values(OrderStatus).includes(statusRaw as OrderStatus)
      ? (statusRaw as OrderStatus)
      : null;

  const { data: listData, isLoading, error } = useAdminOrdersListFromUrl();
  const resetPending = useAdminResetOrderPendingMutation();

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(qParam);

  useEffect(() => {
    setSearchDraft(qParam);
  }, [qParam]);

  const preserve = {
    user: focusUser,
    activity: focusActivity,
    participant: focusParticipant,
  };

  const ordersFilterHref = (next: {
    group?: AdminOrderGroup | null;
    status?: OrderStatus | null;
    q?: string | null;
  }) => {
    const groupInUrl = params.has("group") ? parseAdminOrderGroup(params.get("group")) : null;
    let nextGroup: AdminOrderGroup | null = null;
    if (next.status != null) {
      nextGroup = null;
    } else if (next.group !== undefined) {
      nextGroup = next.group === "all" ? null : next.group;
    } else {
      nextGroup = groupInUrl;
    }
    const href = adminOverviewHref(pathname, {
      ...preserve,
      group: nextGroup,
      status: next.status ?? null,
    });
    const nextQ = next.q !== undefined ? next.q : qParam || null;
    if (!nextQ) return href;
    const u = new URL(href, "http://local");
    u.searchParams.set("q", nextQ);
    return `${u.pathname}?${u.searchParams.toString()}`;
  };

  const clearStatusFilterHref = ordersFilterHref({
    group: params.has("group") ? group : null,
    status: null,
  });

  const orders = listData?.orders ?? [];
  const selectedOrder = orders.find((o) => o.id === selectedOrderId) ?? null;
  const selectedIsPending = selectedOrder?.status === "PENDING_INSTRUCTOR";

  useEffect(() => {
    if (selectedOrderId && !orders.some((o) => o.id === selectedOrderId)) {
      setSelectedOrderId(null);
      setConfirmOpen(false);
    }
  }, [orders, selectedOrderId]);

  const counts = listData?.counts ?? {
    all: data.ordersCount,
    in_progress: 0,
    pending: 0,
    completed: 0,
  };

  const statusEntries = Object.entries(data.ordersByStatus).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Фильтр по этапу</CardTitle>
          <CardDescription>Выберите группу статусов или конкретный статус ниже.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <FilterChip
            active={group === "all" && !status}
            href={ordersFilterHref({ group: null, status: null })}
            label="Все заказы"
            count={counts.all}
          />
          {(Object.keys(ADMIN_ORDER_GROUP_LABELS) as Array<keyof typeof ADMIN_ORDER_GROUP_LABELS>).map(
            (g) => (
              <FilterChip
                key={g}
                active={group === g && !status}
                href={ordersFilterHref({ group: g, status: null })}
                label={ADMIN_ORDER_GROUP_LABELS[g]}
                count={counts[g]}
              />
            ),
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">По статусам</CardTitle>
          <CardDescription>Точечный фильтр по enum OrderStatus.</CardDescription>
        </CardHeader>
        <CardContent>
          {statusEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет данных</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {statusEntries.map(([st, count]) => (
                <Link
                  key={st}
                  href={ordersFilterHref({ group: null, status: st as OrderStatus })}
                  scroll={false}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors",
                    status === st
                      ? "border-accent bg-accent/15 text-foreground"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <span>{orderStatusLabel(st as OrderStatus)}</span>
                  <span className="font-semibold">{count}</span>
                </Link>
              ))}
            </div>
          )}
          {status ? (
            <Button type="button" variant="ghost" size="sm" className="mt-3" asChild>
              <Link href={clearStatusFilterHref} scroll={false} replace>
                Снять фильтр «{orderStatusLabel(status)}»
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-2 border-accent/40">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">
                {status
                  ? `Заказы: ${orderStatusLabel(status)}`
                  : group === "all"
                    ? "Все заказы"
                    : `Заказы: ${ADMIN_ORDER_GROUP_LABELS[group as keyof typeof ADMIN_ORDER_GROUP_LABELS]}`}
                <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                  управление ожиданием
                </span>
              </CardTitle>
              <CardDescription>
                {listData ? `Показано ${listData.total} (до 300 последних)` : "Загрузка…"}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant={selectedIsPending ? "destructive" : "outline"}
              size="sm"
              className="shrink-0"
              disabled={!selectedIsPending || resetPending.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              Отменить ожидание
            </Button>
          </div>

          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(ordersFilterHref({ q: searchDraft.trim() || null }));
            }}
          >
            <Input
              className="max-w-sm"
              placeholder="Поиск: id, email, имя…"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
            />
            <Button type="submit" size="sm" variant="secondary">
              Найти
            </Button>
            {qParam ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearchDraft("");
                  router.push(ordersFilterHref({ q: null }));
                }}
              >
                Сбросить
              </Button>
            ) : null}
          </form>

          <div
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              selectedIsPending
                ? "border-accent/50 bg-accent/10 text-foreground"
                : "border-dashed border-border bg-muted/20 text-muted-foreground",
            )}
          >
            {selectedIsPending && selectedOrder ? (
              <>
                <span className="font-medium">Выбран участник: </span>
                {selectedOrder.clientName ?? "—"}
                <span className="text-muted-foreground"> · {selectedOrder.clientEmail}</span>
                {selectedOrder.instructorName ? (
                  <span className="mt-1 block text-xs">
                    Ожидает ответа: {selectedOrder.instructorName}
                  </span>
                ) : null}
              </>
            ) : (
              <>
                <span className="font-medium">Шаг 1.</span> Выберите в таблице заказ со статусом «Ожидает ответа
                инструктора» (клик по строке).
                <span className="mt-1 block">
                  <span className="font-medium">Шаг 2.</span> Нажмите «Отменить ожидание» — откроется выбор действия.
                </span>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">Не удалось загрузить список заказов.</p>
          ) : (
            <OrdersTable
              orders={orders}
              selectedOrderId={selectedOrderId}
              onSelect={setSelectedOrderId}
              onOpenDetail={setDetailOrderId}
            />
          )}
        </CardContent>
      </Card>

      {detailOrderId ? (
        <AdminOrderDetailSheet orderId={detailOrderId} onClose={() => setDetailOrderId(null)} />
      ) : null}

      {confirmOpen && selectedOrder && selectedIsPending ? (
        <PendingOrderActionModal
          order={selectedOrder}
          pending={resetPending.isPending}
          onClose={() => setConfirmOpen(false)}
          onAction={(action) => {
            resetPending.mutate(
              { orderId: selectedOrder.id, action },
              {
                onSuccess: () => {
                  setConfirmOpen(false);
                  setSelectedOrderId(null);
                },
              },
            );
          }}
        />
      ) : null}
    </div>
  );
}
