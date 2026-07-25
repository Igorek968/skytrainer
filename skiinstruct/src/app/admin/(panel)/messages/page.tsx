"use client";

import { Suspense } from "react";

import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { AdminMessagesSection } from "@/features/admin/sections/admin-messages";
import { AdminSupportInboxSection } from "@/features/admin/sections/admin-support-inbox";
import { Skeleton } from "@/shared/ui/skeleton";

export default function AdminMessagesPage() {
  return (
    <AdminWorkspace
      title="Сообщения"
      subtitle="Входящие тикеты поддержки и исходящие сообщения администраторов (email)."
    >
      {() => (
        <div className="space-y-6">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <AdminSupportInboxSection />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-48 w-full" />}>
            <AdminMessagesSection />
          </Suspense>
        </div>
      )}
    </AdminWorkspace>
  );
}
