"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AdminOverview } from "@/features/admin/admin-overview-types";
import { SKIINSTRUCT_PRODUCT_NAME } from "@/shared/lib/product";

export type AdminOverviewFilters = {
  user?: string | null;
  activity?: string | null;
  participant?: string | null;
};

async function fetchAdminOverview(filters: AdminOverviewFilters): Promise<AdminOverview> {
  const trimmedUser = filters.user?.trim();
  const trimmedActivity = filters.activity?.trim();
  const trimmedParticipant = filters.participant?.trim();
  const params = new URLSearchParams();
  if (trimmedUser) params.set("user", trimmedUser);
  if (trimmedActivity) params.set("activity", trimmedActivity);
  if (trimmedParticipant) params.set("participant", trimmedParticipant);
  const q = params.toString() ? `?${params.toString()}` : "";
  const r = await fetch(`/api/admin/overview${q}`, { credentials: "include" });
  const raw = (await r.json().catch(() => ({}))) as unknown;
  if (r.status === 403) throw new Error("forbidden");
  if (!r.ok) {
    const detail =
      typeof raw === "object" &&
      raw !== null &&
      "message" in raw &&
      typeof (raw as { message: unknown }).message === "string"
        ? (raw as { message: string }).message
        : "";
    throw new Error(detail || `overview-${r.status}`);
  }
  const data = raw as AdminOverview;
  const withContext =
    !data.context?.productName
      ? {
          ...data,
          context: {
            productName: SKIINSTRUCT_PRODUCT_NAME,
            generatedAt: new Date().toISOString(),
          },
        }
      : data;

  if (!withContext.focus) {
    return {
      ...withContext,
      focus: {
        query: trimmedUser || null,
        activityQuery: trimmedActivity || null,
        matches: [],
        email: trimmedUser || null,
        userFound: false,
        activityFilterSkippedNoMatches: false,
        ordersAsClientOrInstructor: 0,
      },
      focusParticipant: (withContext as Partial<AdminOverview>).focusParticipant ?? null,
    };
  }
  return {
    ...withContext,
    focusParticipant: withContext.focusParticipant ?? null,
  };
}

export function useAdminOverview(filters: AdminOverviewFilters = {}) {
  const userKey = filters.user?.trim() ?? "";
  const activityKey = filters.activity?.trim() ?? "";
  const participantKey = filters.participant?.trim() ?? "";
  return useQuery({
    queryKey: ["admin-overview", userKey, activityKey, participantKey],
    queryFn: () => fetchAdminOverview(filters),
    refetchInterval: 15_000,
    staleTime: 8_000,
  });
}

export function useAdminVerifyInstructorMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { userId: string; status: "APPROVED" | "REJECTED" }) => {
      const r = await fetch(`/api/admin/instructors/${params.userId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: params.status }),
      });
      if (!r.ok) throw new Error("verify");
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-overview"], exact: false });
      toast.success("Обновлено");
    },
    onError: () => toast.error("Ошибка"),
  });
}
