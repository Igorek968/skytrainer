import type { InstructorTaxStatus } from "@prisma/client";

/** Публичная подпись налогового статуса инструктора для клиента. */
export function instructorTaxStatusPublicLabel(status: InstructorTaxStatus | null | undefined): string | null {
  if (status === "IP") return "индивидуальный предприниматель (ИП)";
  if (status === "SELF_EMPLOYED") return "самозанятый (НПД)";
  return null;
}
