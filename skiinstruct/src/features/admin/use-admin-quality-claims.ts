"use client";

import { useQuery } from "@tanstack/react-query";

import type { AdminQualityClaimRow } from "@/lib/admin-quality-claims";
import { devPollInterval } from "@/lib/query-poll";

type QualityClaimsResponse = {
  generatedAt: string;
  count: number;
  rows: AdminQualityClaimRow[];
};

async function fetchQualityClaims(failedOnly: boolean): Promise<QualityClaimsResponse> {
  const q = failedOnly ? "?failedOnly=1" : "";
  const r = await fetch(`/api/admin/quality-claims${q}`, { credentials: "include", cache: "no-store" });
  if (r.status === 403) throw new Error("forbidden");
  if (!r.ok) throw new Error("quality-claims-load");
  return r.json() as Promise<QualityClaimsResponse>;
}

export function useAdminQualityClaims(failedOnly = false) {
  return useQuery({
    queryKey: ["admin-quality-claims", failedOnly],
    queryFn: () => fetchQualityClaims(failedOnly),
    refetchInterval: devPollInterval(20_000),
    staleTime: 10_000,
  });
}
