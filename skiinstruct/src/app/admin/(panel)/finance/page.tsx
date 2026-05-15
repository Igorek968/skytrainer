"use client";

import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { AdminFinanceSection } from "@/features/admin/sections/admin-finance";

export default function AdminFinancePage() {
  return (
    <AdminWorkspace
      title="Финансы"
      subtitle="Сводка по оплаченным заказам: выручка, доля инструкторов и условная доля платформы."
    >
      {(data) => <AdminFinanceSection data={data} />}
    </AdminWorkspace>
  );
}
