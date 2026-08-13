"use client";

import { useQuery } from "@tanstack/react-query";

import { formatInAppTimeZone } from "@/shared/lib/app-timezone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { devPollInterval } from "@/lib/query-poll";

type AuditRow = {
  id: string;
  actorId: string | null;
  actorLabel?: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
};

export function AdminAuditLogSection() {
  const query = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => {
      const r = await fetch("/api/admin/audit?limit=80", {
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`audit-${r.status}`);
      return r.json() as Promise<{ rows: AuditRow[] }>;
    },
    staleTime: 10_000,
    refetchInterval: devPollInterval(30_000),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Журнал действий админа</CardTitle>
        <CardDescription>
          Кто что сделал: модерация анкет, документы, заказы, поддержка. Видно и админу, и модератору.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : query.error ? (
          <p className="text-sm text-destructive">Не удалось загрузить журнал.</p>
        ) : !query.data?.rows.length ? (
          <p className="text-sm text-muted-foreground">Пока пусто.</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {query.data.rows.map((r) => (
              <li key={r.id} className="rounded-md border border-border/80 px-3 py-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{r.action}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.entity}
                    {r.entityId ? ` · ${r.entityId.slice(0, 8)}…` : ""}
                  </span>
                </div>
                <p className="mt-0.5">{r.summary}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {r.actorLabel ?? "—"} · {formatInAppTimeZone(r.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
