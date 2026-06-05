"use client";

import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { AdminFinanceSection } from "@/features/admin/sections/admin-finance";
import { AdminPayoutRequestsSection } from "@/features/admin/sections/admin-payout-requests";

export default function AdminFinancePage() {
  return (
    <AdminWorkspace
      title="Финансы"
      subtitle="Сводка по оплаченным заказам: выручка, доля инструкторов и условная доля платформы."
    >
      {(data) => (
        <div className="space-y-6">
          <AdminFinanceSection data={data} />
          <AdminPayoutRequestsSection />
        </div>
      )}
    </AdminWorkspace>
  );
}
