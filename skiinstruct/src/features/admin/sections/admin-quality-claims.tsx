"use client";

import Link from "next/link";
import { useState } from "react";

import { useAdminQualityClaims } from "@/features/admin/use-admin-quality-claims";
import { LEGAL_ROUTES } from "@/lib/legal";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/shared/ui/skeleton";

function formatDt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

function refundStatusLabel(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "Возврат выполнен";
    case "PENDING":
      return "В обработке";
    case "FAILED":
      return "Ошибка возврата";
    case "NOT_APPLICABLE":
      return "Не применимо";
    default:
      return status;
  }
}

function refundStatusVariant(status: string): "default" | "secondary" | "outline" | "accent" {
  if (status === "COMPLETED") return "accent";
  if (status === "FAILED") return "outline";
  if (status === "PENDING") return "secondary";
  return "outline";
}

export function AdminQualityClaimsSection() {
  const [failedOnly, setFailedOnly] = useState(false);
  const query = useAdminQualityClaims(failedOnly);
  const rows = query.data?.rows ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Претензии по качеству урока</CardTitle>
        <CardDescription>
          Автоматические претензии клиентов после завершённых занятий (алгоритм —{" "}
          <Link href={LEGAL_ROUTES.returns} className="text-accent underline" target="_blank" rel="noopener noreferrer">
            правила возврата п. 2.5
          </Link>
          ).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={failedOnly ? "outline" : "secondary"}
            onClick={() => setFailedOnly(false)}
          >
            Все ({query.data && !failedOnly ? query.data.count : "…"})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={failedOnly ? "secondary" : "outline"}
            onClick={() => setFailedOnly(true)}
          >
            Только с ошибкой возврата
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => void query.refetch()}>
            Обновить
          </Button>
        </div>

        {query.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : query.error ? (
          <p className="text-sm text-destructive">Не удалось загрузить претензии.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Претензий пока нет.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Дата</th>
                  <th className="py-2 pr-3 font-medium">Заказ</th>
                  <th className="py-2 pr-3 font-medium">Клиент</th>
                  <th className="py-2 pr-3 font-medium">Инструктор</th>
                  <th className="py-2 pr-3 font-medium">Причина</th>
                  <th className="py-2 pr-3 font-medium">Оценка</th>
                  <th className="py-2 pr-3 font-medium">Возврат</th>
                  <th className="py-2 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.orderId} className="border-b border-border/80 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                      {formatDt(row.claimedAt)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      <Link
                        href={`/client/orders/${row.orderId}`}
                        className="text-accent underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {row.orderId.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="max-w-[140px] truncate font-medium">{row.clientName ?? "—"}</div>
                      <div className="max-w-[140px] truncate text-xs text-muted-foreground">
                        {row.clientEmail ?? row.clientId.slice(0, 8)}
                      </div>
                    </td>
                    <td className="py-2 pr-3 max-w-[120px] truncate">{row.instructorName ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <div className="font-medium">{row.categoryLabel}</div>
                      {row.description ? (
                        <p className="mt-1 max-w-[220px] text-xs text-muted-foreground line-clamp-3">
                          {row.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">{row.clientRating ?? "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {row.refundAmount != null && row.refundAmount > 0
                        ? `${row.refundAmount} ₽ (${row.refundPercent ?? 0}%)`
                        : "—"}
                    </td>
                    <td className="py-2">
                      <Badge
                        variant={refundStatusVariant(row.refundStatus)}
                        className={cn("text-xs", row.refundStatus === "FAILED" && "border-destructive text-destructive")}
                      >
                        {refundStatusLabel(row.refundStatus)}
                      </Badge>
                      {row.refundNote ? (
                        <p
                          className={cn(
                            "mt-1 max-w-[180px] text-xs",
                            row.refundStatus === "FAILED" ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {row.refundNote}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
