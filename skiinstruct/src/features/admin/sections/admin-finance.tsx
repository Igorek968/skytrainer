"use client";

import type { AdminOverview } from "@/features/admin/admin-overview-types";
import { adminMoney } from "@/features/admin/admin-overview-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export function AdminFinanceSection({ data }: { data: AdminOverview }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Финансовый кабинет</CardTitle>
        <CardDescription>По оплаченным заказам (paymentStatus = PAID).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between border-b border-border py-2">
          <span className="text-muted-foreground">Оплаченных заказов</span>
          <span className="font-medium">{data.finance.paidOrdersCount}</span>
        </div>
        <div className="flex justify-between border-b border-border py-2">
          <span className="text-muted-foreground">Сумма к оплате клиентами</span>
          <span className="font-medium">{adminMoney(data.finance.grossPaidRub)}</span>
        </div>
        <div className="flex justify-between border-b border-border py-2">
          <span className="text-muted-foreground">Доля инструкторов (после комиссии)</span>
          <span className="font-medium">{adminMoney(data.finance.instructorSharePaidRub)}</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-muted-foreground">Условная доля платформы (15% в модели)</span>
          <span className="font-semibold text-accent">{adminMoney(data.finance.platformSharePaidRub)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          «Доля платформы» = сумма заказов минус сумма долей инструкторов по уже оплаченным заказам. Не заменяет
          бухгалтерский учёт выплат.
        </p>
      </CardContent>
    </Card>
  );
}
