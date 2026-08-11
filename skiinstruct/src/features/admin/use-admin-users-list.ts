"use client";

import { useQuery } from "@tanstack/react-query";
import type { UserRole } from "@prisma/client";

import type { AdminUserRoleFilter } from "@/lib/admin-list-filters";
import { devPollInterval } from "@/lib/query-poll";

export type AdminUserListRow = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isOnline: boolean;
  verificationStatus: string | null;
  specializations: string[];
  /** Анкета договора заполнена полностью. */
  anketaComplete?: boolean;
  /** verificationStatus === APPROVED */
  verifiedOk?: boolean;
};

export type AdminUsersListResponse = {
  role: AdminUserRoleFilter;
  online: boolean;
  total: number;
  users: AdminUserListRow[];
  counts: {
    all: number;
    CLIENT: number;
    INSTRUCTOR: number;
    ADMIN: number;
    online: number;
  };
};

export function useAdminUsersList(
  role: AdminUserRoleFilter,
  onlineOnly: boolean,
  searchQ = "",
) {
  const q = searchQ.trim();
  return useQuery({
    queryKey: ["admin-users-list", role, onlineOnly, q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (role !== "all") params.set("role", role);
      if (onlineOnly) params.set("online", "1");
      if (q) params.set("q", q);
      const qs = params.toString();
      const r = await fetch(`/api/admin/users${qs ? `?${qs}` : ""}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (r.status === 403) throw new Error("forbidden");
      if (!r.ok) throw new Error(`users-${r.status}`);
      return r.json() as Promise<AdminUsersListResponse>;
    },
    staleTime: 10_000,
    refetchInterval: devPollInterval(15_000),
  });
}
