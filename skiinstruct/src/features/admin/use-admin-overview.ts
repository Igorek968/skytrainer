"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AdminOverview } from "@/features/admin/admin-overview-types";
import { devPollInterval } from "@/lib/query-poll";
import { PRODUCT_NAME } from "@/shared/lib/product";

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
  const r = await fetch(`/api/admin/overview${q}`, {
    credentials: "include",
    cache: "no-store",
  });
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
            productName: PRODUCT_NAME,
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
    refetchInterval: devPollInterval(15_000),
    staleTime: 8_000,
    refetchOnWindowFocus: true,
  });
}

export function useAdminProfileReviewMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      userId: string;
      action: "approve" | "reject";
      rejectMessage?: string;
    }) => {
      const r = await fetch(`/api/admin/instructors/${params.userId}/profile-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: params.action,
          ...(params.action === "reject" ? { rejectMessage: params.rejectMessage } : {}),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: unknown };
      if (!r.ok) {
        const msg =
          typeof j.error === "object" &&
          j.error !== null &&
          "fieldErrors" in j.error &&
          typeof (j.error as { fieldErrors?: { rejectMessage?: string[] } }).fieldErrors
            ?.rejectMessage?.[0] === "string"
            ? (j.error as { fieldErrors: { rejectMessage: string[] } }).fieldErrors.rejectMessage[0]
            : "Не удалось обработать заявку";
        throw new Error(msg);
      }
    },
    onSuccess: async (_data, params) => {
      await qc.invalidateQueries({ queryKey: ["admin-overview"], exact: false });
      toast.success(
        params.action === "reject" ? "Изменения отклонены, ответ отправлен инструктору" : "Изменения опубликованы",
      );
    },
    onError: (e: Error) => toast.error(e.message || "Ошибка"),
  });
}

export function useAdminVerifyInstructorMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      userId: string;
      status: "APPROVED" | "REJECTED";
      rejectMessage?: string;
    }) => {
      const r = await fetch(`/api/admin/instructors/${params.userId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: params.status,
          ...(params.status === "REJECTED" ? { rejectMessage: params.rejectMessage } : {}),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: unknown };
      if (!r.ok) {
        const msg =
          typeof j.error === "object" &&
          j.error !== null &&
          "fieldErrors" in j.error &&
          typeof (j.error as { fieldErrors?: { rejectMessage?: string[] } }).fieldErrors
            ?.rejectMessage?.[0] === "string"
            ? (j.error as { fieldErrors: { rejectMessage: string[] } }).fieldErrors.rejectMessage[0]
            : "Не удалось обработать заявку";
        throw new Error(msg);
      }
    },
    onSuccess: async (_data, params) => {
      await qc.invalidateQueries({ queryKey: ["admin-overview"], exact: false });
      toast.success(params.status === "REJECTED" ? "Заявка отклонена" : "Инструктор одобрен");
    },
    onError: (e: Error) => toast.error(e.message || "Ошибка"),
  });
}
