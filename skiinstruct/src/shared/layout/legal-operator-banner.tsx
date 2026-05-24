import { legalOperatorName } from "@/lib/legal";
import { LEGAL_PLATFORM_NAME, LEGAL_PLATFORM_URL } from "@/lib/legal-config";

export function LegalOperatorBanner() {
  const operator = legalOperatorName();
  return (
    <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      Платформа «{LEGAL_PLATFORM_NAME}»:{" "}
      <a className="text-accent underline" href={LEGAL_PLATFORM_URL}>
        {LEGAL_PLATFORM_URL}
      </a>
      . Оператор: <span className="font-medium text-foreground">{operator}</span>.
    </p>
  );
}
