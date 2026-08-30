"use client";

import { EVENT_PARTY_MAX_PEOPLE } from "@/lib/event-party";
import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";

export function QuantityStepper({
  id,
  label,
  value,
  min = 0,
  max,
  disabled,
  onChange,
  className,
}: {
  id: string;
  label?: string;
  value: number;
  min?: number;
  max: number;
  disabled?: boolean;
  onChange: (next: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label ? (
        <label htmlFor={id} className="text-xs font-medium text-foreground">
          {label}
        </label>
      ) : null}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 w-8 px-0"
          disabled={disabled || value <= min}
          aria-label={label ? `${label}: меньше` : "Меньше"}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </Button>
        <span id={id} className="w-7 text-center text-sm font-semibold tabular-nums">
          {value}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 w-8 px-0"
          disabled={disabled || value >= max}
          aria-label={label ? `${label}: больше` : "Больше"}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </Button>
      </div>
    </div>
  );
}

/** Одно поле «сколько человек» — для события без отдельных тарифов. */
export function EventQuantityField({
  id,
  value,
  onChange,
  maxTotal,
  disabled,
  className,
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
  maxTotal?: number | null;
  disabled?: boolean;
  className?: string;
}) {
  const cap = Math.min(
    EVENT_PARTY_MAX_PEOPLE,
    maxTotal != null && maxTotal > 0 ? maxTotal : EVENT_PARTY_MAX_PEOPLE,
  );
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <QuantityStepper
        id={id}
        label="Участников"
        value={value}
        min={1}
        max={Math.max(1, cap)}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}
