"use client";

import { Suspense } from "react";

import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { AdminUsersSection } from "@/features/admin/sections/admin-users";
import { Skeleton } from "@/shared/ui/skeleton";

export default function AdminUsersPage() {
  return (
    <AdminWorkspace
      title="Пользователи"
      subtitle="Все аккаунты в базе: клиенты, инструкторы и администраторы. Фильтры по роли и статусу «на линии»."
    >
      {() => (
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <AdminUsersSection />
        </Suspense>
      )}
    </AdminWorkspace>
  );
}
