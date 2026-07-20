"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

type MeProfile = {
  name: string | null;
  email: string;
  birthDate: string | null;
};

export function HeaderAccountHint() {
  const queryClient = useQueryClient();
  const { data: session, status } = useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    if (status === "unauthenticated") {
      void queryClient.removeQueries({ queryKey: ["me-profile"] });
    }
  }, [status, queryClient]);

  const { data } = useQuery({
    queryKey: ["me-profile", userId],
    queryFn: async () => {
      const r = await fetch("/api/me/profile", { cache: "no-store" });
      if (r.status === 401 || !r.ok) return null;
      return r.json() as Promise<MeProfile>;
    },
    enabled: status === "authenticated" && Boolean(userId),
    staleTime: 60_000,
  });

  if (status !== "authenticated" || !userId) return null;

  const contactLine = data?.email ?? session.user?.email ?? "";
  if (!contactLine) return null;

  return (
    <p className="max-w-[min(320px,70vw)] text-[11px] leading-snug text-muted-foreground">
      {contactLine}
    </p>
  );
}
