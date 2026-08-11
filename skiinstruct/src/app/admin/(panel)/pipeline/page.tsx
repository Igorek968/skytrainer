"use client";

import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { AdminPipelineSection } from "@/features/admin/sections/admin-pipeline";

export default function AdminPipelinePage() {
  return (
    <AdminWorkspace
      title="Воронка заказов"
      subtitle="От черновика до урока: matching, rescue и работа. Карточки открывают фильтры заказов."
    >
      {(data) => <AdminPipelineSection data={data} />}
    </AdminWorkspace>
  );
}
