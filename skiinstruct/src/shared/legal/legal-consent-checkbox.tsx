"use client";

import { Check } from "lucide-react";
import Link from "next/link";

import { LEGAL_ROUTES } from "@/lib/legal";
import { cn } from "@/lib/utils";

type LegalConsentCheckboxProps = {
  id: string;
  name?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
  includeReturns?: boolean;
  className?: string;
};

function stopBubble(e: React.SyntheticEvent) {
  e.stopPropagation();
}

/** Обязательное согласие с офертой, ПДн и (опционально) правилами возврата. */
export function LegalConsentCheckbox({
  id,
  name,
  checked,
  onChange,
  required = true,
  includeReturns = false,
  className,
}: LegalConsentCheckboxProps) {
  const toggle = () => onChange(!checked);

  return (
    <div
      className={cn("flex items-start gap-2 text-sm", className)}
      onPointerDown={stopBubble}
      onClick={stopBubble}
    >
      {name && checked ? <input type="hidden" name={name} value="on" /> : null}
      <button
        type="button"
        id={id}
        role="checkbox"
        aria-checked={checked}
        aria-required={required}
        aria-labelledby={`${id}-label`}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input bg-background shadow-sm transition-colors",
          checked && "border-accent bg-accent text-accent-foreground",
        )}
      >
        {checked ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
      </button>
      <p
        id={`${id}-label`}
        className="cursor-pointer leading-snug"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) return;
          toggle();
        }}
      >
        Я принимаю условия{" "}
        <Link
          className="text-accent underline"
          href={LEGAL_ROUTES.oferta}
          onClick={stopBubble}
          onPointerDown={stopBubble}
        >
          Договора-оферты
        </Link>
        ,{" "}
        <Link
          className="text-accent underline"
          href={LEGAL_ROUTES.privacy}
          onClick={stopBubble}
          onPointerDown={stopBubble}
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
              onClick={stopBubble}
              onPointerDown={stopBubble}
            >
              правил возврата
            </Link>
          </>
        ) : null}
        .
      </p>
    </div>
  );
}
