"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AdminOrderOverviewRow } from "@/features/admin/admin-overview-types";

export type AdminPendingOrderAction = "next_instructor" | "cancel_waiting";

type ResetPendingResult = {
  ok: boolean;
  action: AdminPendingOrderAction;
  message: string;
  order: AdminOrderOverviewRow;
};

export function useAdminResetOrderPendingMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      action,
    }: {
      orderId: string;
      action: AdminPendingOrderAction;
    }) => {
      const r = await fetch(`/api/admin/orders/${orderId}/reset-pending`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Не удалось выполнить действие");
      }
      return j as ResetPendingResult;
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["admin-orders-list"], exact: false });
      await qc.invalidateQueries({ queryKey: ["admin-overview"], exact: false });
      toast.success(data.message);
    },
    onError: (e: Error) => toast.error(e.message || "Ошибка"),
  });
}
