"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import type { OrderStatus } from "@prisma/client";

import type { AdminOrderOverviewRow } from "@/features/admin/admin-overview-types";
import { parseAdminOrderGroup, type AdminOrderGroup } from "@/lib/admin-list-filters";
import { devPollInterval } from "@/lib/query-poll";

const ORDER_STATUSES = new Set<string>([
  "DRAFT",
  "AWAITING_PAYMENT",
  "PENDING_INSTRUCTOR",
  "ACCEPTED",
  "INSTRUCTOR_EN_ROUTE",
  "LESSON_STARTED",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
  "EXPIRED",
]);

function parseStatusParam(raw: string | null): OrderStatus | null {
  const t = raw?.trim();
  if (!t || !ORDER_STATUSES.has(t)) return null;
  return t as OrderStatus;
}

export type AdminOrdersListResponse = {
  group: AdminOrderGroup;
  status: OrderStatus | null;
  total: number;
  orders: AdminOrderOverviewRow[];
  counts: Record<AdminOrderGroup, number>;
};

export function useAdminOrdersListFromUrl() {
  const params = useSearchParams();
  const group = parseAdminOrderGroup(params.get("group"));
  const status = parseStatusParam(params.get("status"));
  const q = params.get("q")?.trim() || "";

  return useQuery({
    queryKey: ["admin-orders-list", group, status, q],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (status) search.set("status", status);
      else if (group !== "all") search.set("group", group);
      if (q) search.set("q", q);
      const qs = search.toString();
      const r = await fetch(`/api/admin/orders${qs ? `?${qs}` : ""}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (r.status === 403) throw new Error("forbidden");
      if (!r.ok) throw new Error(`orders-${r.status}`);
      return r.json() as Promise<AdminOrdersListResponse>;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: devPollInterval(15_000),
  });
}
