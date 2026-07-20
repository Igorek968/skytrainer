"use client";

import { Suspense } from "react";

import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { AdminMessagesSection } from "@/features/admin/sections/admin-messages";
import { Skeleton } from "@/shared/ui/skeleton";

export default function AdminMessagesPage() {
  return (
    <AdminWorkspace
      title="Сообщения"
      subtitle="Исходящие сообщения администраторов пользователям и инструкторам (с дублем на email)."
    >
      {() => (
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <AdminMessagesSection />
        </Suspense>
      )}
    </AdminWorkspace>
  );
}
