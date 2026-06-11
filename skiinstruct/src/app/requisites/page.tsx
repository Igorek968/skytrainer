import type { Metadata } from "next";

import { formatLegalEditionDate } from "@/lib/legal-config";
import { LegalRequisitesBlock } from "@/shared/legal/legal-requisites-block";
import { LegalDocLayout } from "@/shared/layout/legal-doc-layout";

export const metadata: Metadata = {
  title: "Реквизиты",
  description: "Реквизиты ИП Ершов А.В. — uTrainer",
};

export default function RequisitesPage() {
  return (
    <LegalDocLayout title="Реквизиты">
      <p className="text-muted-foreground">
        Реквизиты агента (оператора сервиса uTrainer) для оплаты и договорных отношений.
      </p>
      <LegalRequisitesBlock />
      <p className="text-xs text-muted-foreground">Редакция от {formatLegalEditionDate()}.</p>
    </LegalDocLayout>
  );
}
