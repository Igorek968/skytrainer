"use client";

import { useQuery } from "@tanstack/react-query";

import type { InstructorFunnelResponse } from "@/app/api/admin/instructors/funnel/route";

export function useAdminInstructorsFunnel() {
  return useQuery({
    queryKey: ["admin-instructors-funnel"],
    queryFn: async (): Promise<InstructorFunnelResponse> => {
      const r = await fetch("/api/admin/instructors/funnel", {
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) {
        if (r.status === 403) throw new Error("forbidden");
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `funnel-${r.status}`);
      }
      return r.json() as Promise<InstructorFunnelResponse>;
    },
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
}
