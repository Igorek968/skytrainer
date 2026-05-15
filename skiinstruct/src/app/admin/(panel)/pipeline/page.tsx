"use client";

import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { AdminPipelineSection } from "@/features/admin/sections/admin-pipeline";

export default function AdminPipelinePage() {
  return (
    <AdminWorkspace
      title="Воронка заказов"
      subtitle="Где заявки ждут инструктора, оплаты или уже в работе."
    >
      {(data) => <AdminPipelineSection data={data} />}
    </AdminWorkspace>
  );
}
