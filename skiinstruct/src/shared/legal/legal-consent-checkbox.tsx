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
    <label className={`flex cursor-pointer gap-2 text-sm ${className ?? ""}`}>
      <input
        id={id}
        name={name}
        type="checkbox"
        className="mt-1"
        required={required}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        Я принимаю условия{" "}
        <Link className="text-accent underline" href={LEGAL_ROUTES.oferta} target="_blank">
          агентской оферты
        </Link>
        ,{" "}
        <Link className="text-accent underline" href={LEGAL_ROUTES.privacy} target="_blank">
          политики обработки ПДн
        </Link>
        {includeReturns ? (
          <>
            {" "}
            и{" "}
            <Link className="text-accent underline" href={LEGAL_ROUTES.returns} target="_blank">
              правил возврата
            </Link>
          </>
        ) : null}
        .
      </span>
    </label>
  );
}
