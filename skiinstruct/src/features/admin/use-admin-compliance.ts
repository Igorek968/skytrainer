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

export function useAdminYookassaContractMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      userId: string;
      action: "notify" | "mark_sent";
      force?: boolean;
    }) => {
      const r = await fetch(`/api/admin/agency-registry/${params.userId}/yookassa-contract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: params.action, force: params.force }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        skipped?: boolean;
        reason?: string;
        to?: string;
      };
      if (!r.ok) throw new Error(j.error ?? "yookassa-contract-failed");
      return j;
    },
    onSuccess: async (data, params) => {
      await qc.invalidateQueries({ queryKey: ["admin-agency-registry"] });
      if (params.action === "mark_sent") {
        toast.success("Отмечено: передано в ЮKassa");
      } else if (data.skipped) {
        toast.message(data.reason ?? "Пропущено");
      } else {
        toast.success(data.to ? `Договор отправлен на ${data.to}` : "Договор отправлен");
      }
    },
    onError: (e: Error) => toast.error(e.message || "Ошибка"),
  });
}

export function useAdminYookassaBulkNotifyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params?: { force?: boolean }) => {
      const r = await fetch("/api/admin/agency-registry/notify-yookassa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ force: params?.force === true, limit: 200 }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        sent?: number;
        skipped?: number;
        failed?: number;
        total?: number;
      };
      if (!r.ok) throw new Error(j.error ?? "bulk-notify-failed");
      return j;
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["admin-agency-registry"] });
      toast.success(
        `Рассылка: отправлено ${data.sent ?? 0}, пропущено ${data.skipped ?? 0}, ошибок ${data.failed ?? 0}`,
      );
    },
    onError: (e: Error) => toast.error(e.message || "Ошибка рассылки"),
  });
}

