"use client";

import { EVENT_PARTY_MAX_PEOPLE } from "@/lib/event-party";
import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";

function Stepper({
  id,
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5">
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 w-7 px-0"
          disabled={disabled || value <= min}
          aria-label={`${label}: меньше`}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </Button>
        <span id={id} className="w-6 text-center text-sm font-semibold tabular-nums">
          {value}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 w-7 px-0"
          disabled={disabled || value >= max}
          aria-label={`${label}: больше`}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </Button>
      </div>
    </div>
  );
}

export function EventPartyFields({
  adultCount,
  childCount,
  onAdultCount,
  onChildCount,
  maxTotal,
  disabled,
  className,
  idPrefix = "event-party",
}: {
  adultCount: number;
  childCount: number;
  onAdultCount: (n: number) => void;
  onChildCount: (n: number) => void;
  maxTotal?: number | null;
  disabled?: boolean;
  className?: string;
  idPrefix?: string;
}) {
  const cap = Math.min(EVENT_PARTY_MAX_PEOPLE, maxTotal != null && maxTotal > 0 ? maxTotal : EVENT_PARTY_MAX_PEOPLE);
  const adultMax = Math.max(0, cap - childCount);
  const childMax = Math.max(0, cap - adultCount);

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-medium text-foreground">Состав группы</p>
      <div className="flex flex-col gap-1.5 sm:flex-row">
        <Stepper
          id={`${idPrefix}-adults`}
          label="Взрослых"
          value={adultCount}
          min={0}
          max={adultMax}
          disabled={disabled}
          onChange={onAdultCount}
        />
        <Stepper
          id={`${idPrefix}-children`}
          label="Детей"
          value={childCount}
          min={0}
          max={childMax}
          disabled={disabled}
          onChange={onChildCount}
        />
      </div>
    </div>
  );
}
