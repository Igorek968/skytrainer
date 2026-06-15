import Link from "next/link";

import { LEGAL_ROUTES } from "@/lib/legal";

type LegalConsentCheckboxProps = {
  id: string;
  name?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
  includeReturns?: boolean;
  className?: string;
};

/** Обязательное согласие с офертой, ПДн и (опционально) правилами возврата. */
export function LegalConsentCheckbox({
  id,
  name = "acceptLegal",
  checked,
  onChange,
  required = true,
  includeReturns = false,
  className,
}: LegalConsentCheckboxProps) {
  return (
    <div className={`flex gap-2 text-sm ${className ?? ""}`}>
      <input
        id={id}
        name={name}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border border-input accent-[hsl(var(--accent))]"
        required={required}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        onClick={(e) => e.stopPropagation()}
      />
      <label htmlFor={id} className="cursor-pointer leading-snug">
        Я принимаю условия{" "}
        <Link
          className="text-accent underline"
          href={LEGAL_ROUTES.oferta}
          onClick={(e) => e.stopPropagation()}
        >
          Договора-оферты
        </Link>
        ,{" "}
        <Link
          className="text-accent underline"
          href={LEGAL_ROUTES.privacy}
          onClick={(e) => e.stopPropagation()}
        >
          политики обработки ПДн
        </Link>
        {includeReturns ? (
          <>
            {" "}
            и{" "}
            <Link
              className="text-accent underline"
              href={LEGAL_ROUTES.returns}
              onClick={(e) => e.stopPropagation()}
            >
              правил возврата
            </Link>
          </>
        ) : null}
        .
      </label>
    </div>
  );
}
