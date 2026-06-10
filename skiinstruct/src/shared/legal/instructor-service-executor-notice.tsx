import { instructorTaxStatusPublicLabel } from "@/lib/instructor-tax-status-label";
import type { InstructorTaxStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

type Props = {
  instructorName: string | null;
  taxStatus?: InstructorTaxStatus | null;
  className?: string;
};

/** Клиенту: кто оказывает услугу обучения и что договор — с инструктором. */
export function InstructorServiceExecutorNotice({ instructorName, taxStatus, className }: Props) {
  const statusLabel = instructorTaxStatusPublicLabel(taxStatus);

  return (
    <div className={cn("rounded-md border border-border bg-muted/30 p-3 text-sm", className)}>
      <p className="font-medium text-foreground">Исполнитель услуги обучения</p>
      <p className="mt-1 text-muted-foreground">
        Услугу оказывает{" "}
        <span className="font-medium text-foreground">{instructorName?.trim() || "—"}</span>
        {statusLabel ? (
          <>
            , <span className="text-foreground">{statusLabel}</span>
          </>
        ) : null}
        . Договор на занятие заключается между вами и выбранным инструктором; платформа (агент) обеспечивает
        бронирование и приём оплаты. Чек на обучение выставляет инструктор.
      </p>
    </div>
  );
}
