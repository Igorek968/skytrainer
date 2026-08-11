"use client";

import { Suspense } from "react";

import { AdminInstructorsFunnelSection } from "@/features/admin/sections/admin-instructors-funnel";
import { Skeleton } from "@/shared/ui/skeleton";

export default function AdminInstructorsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Воронка инструкторов</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CRM найма: от заявки до выхода на линию — стадии, SLA и следующее действие оператора.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <AdminInstructorsFunnelSection />
      </Suspense>
    </div>
  );
}
