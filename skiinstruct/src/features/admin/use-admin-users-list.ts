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
  createdAt: string;
  updatedAt: string;
  isOnline: boolean;
  verificationStatus: string | null;
  specializations: string[];
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

export function useAdminUsersList(role: AdminUserRoleFilter, onlineOnly: boolean) {
  return useQuery({
    queryKey: ["admin-users-list", role, onlineOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (role !== "all") params.set("role", role);
      if (onlineOnly) params.set("online", "1");
      const q = params.toString();
      const r = await fetch(`/api/admin/users${q ? `?${q}` : ""}`, {
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
