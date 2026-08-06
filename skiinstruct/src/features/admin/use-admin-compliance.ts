"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ClientBookingRegistryRow } from "@/lib/client-booking-registry";
import type { AgencyRegistryRow } from "@/lib/instructor-agency-registry";
import type { PendingComplianceItem } from "@/lib/instructor-agency-registry";
import { devPollInterval } from "@/lib/query-poll";

type RegistryResponse = {
  generatedAt: string;
  count: number;
  rows: AgencyRegistryRow[];
};

type ClientRegistryResponse = {
  generatedAt: string;
  count: number;
  rows: ClientBookingRegistryRow[];
};

type PendingResponse = {
  generatedAt: string;
  count: number;
  items: PendingComplianceItem[];
};

async function fetchRegistry(activeOnly: boolean): Promise<RegistryResponse> {
  const q = activeOnly ? "?activeOnly=1" : "";
  const r = await fetch(`/api/admin/agency-registry${q}`, { credentials: "include", cache: "no-store" });
  if (r.status === 403) throw new Error("forbidden");
  if (!r.ok) throw new Error("registry-load");
  return r.json() as Promise<RegistryResponse>;
}

async function fetchClientRegistry(paidOnly: boolean): Promise<ClientRegistryResponse> {
  const q = paidOnly ? "?paidOnly=1" : "";
  const r = await fetch(`/api/admin/client-registry${q}`, { credentials: "include", cache: "no-store" });
  if (r.status === 403) throw new Error("forbidden");
  if (!r.ok) throw new Error("client-registry-load");
  return r.json() as Promise<ClientRegistryResponse>;
}

async function fetchPending(): Promise<PendingResponse> {
  const r = await fetch("/api/admin/compliance/pending", { credentials: "include", cache: "no-store" });
  if (r.status === 403) throw new Error("forbidden");
  if (!r.ok) throw new Error("pending-load");
  return r.json() as Promise<PendingResponse>;
}

export function useAdminAgencyRegistry(activeOnly = false) {
  return useQuery({
    queryKey: ["admin-agency-registry", activeOnly],
    queryFn: () => fetchRegistry(activeOnly),
    refetchInterval: devPollInterval(20_000),
    staleTime: 10_000,
  });
}

export function useAdminClientRegistry(paidOnly = false) {
  return useQuery({
    queryKey: ["admin-client-registry", paidOnly],
    queryFn: () => fetchClientRegistry(paidOnly),
    refetchInterval: devPollInterval(20_000),
    staleTime: 10_000,
  });
}

export function useAdminPendingCompliance() {
  return useQuery({
    queryKey: ["admin-compliance-pending"],
    queryFn: fetchPending,
    refetchInterval: devPollInterval(15_000),
    staleTime: 8_000,
  });
}

export function useAdminComplianceReviewMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      userId: string;
      documentId: string;
      status: "APPROVED" | "REJECTED";
      rejectNote?: string;
    }) => {
      const r = await fetch(`/api/admin/instructors/${params.userId}/compliance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          documentId: params.documentId,
          status: params.status,
          rejectNote: params.rejectNote,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "review-failed");
    },
    onSuccess: async (_data, params) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-compliance-pending"] }),
        qc.invalidateQueries({ queryKey: ["admin-agency-registry"] }),
      ]);
      toast.success(params.status === "APPROVED" ? "Документ одобрен" : "Документ отклонён");
    },
    onError: (e: Error) => toast.error(e.message || "Ошибка"),
  });
}
