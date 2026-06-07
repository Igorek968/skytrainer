"use client";

import { ReferralProgramPanel } from "@/features/referral/referral-program-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export default function ClientReferralPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Реферальная программа</CardTitle>
          <CardDescription>
            Делитесь ссылкой — получайте 250 ₽ за каждый из первых 4 завершённых заказов приглашённого
            клиента. Баланс можно тратить на занятия или выводить от 500 ₽.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReferralProgramPanel showClientPayoutHintForm />
        </CardContent>
      </Card>
    </div>
  );
}
