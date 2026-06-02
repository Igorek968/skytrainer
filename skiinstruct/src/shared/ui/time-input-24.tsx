"use client";

import * as React from "react";
import { Clock } from "lucide-react";

import { minutesToHm } from "@/shared/lib/lesson-booking-time";
import { cn } from "@/lib/utils";

import { Input, type InputProps } from "@/shared/ui/input";

/** Нормализует ввод к HH:mm (24 ч) или null при невалидном значении. */
export function normalizeTimeInput24(raw: string): string | null {
  const t = raw.trim();
  const fromNative = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (fromNative) {
    const h = Number(fromNative[1]);
    const min = Number(fromNative[2]);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return minutesToHm(h * 60 + min);
    }
    return null;
  }
  const withColon = t.match(/^(\d{1,2}):(\d{1,2})$/);
  if (withColon) {
    const h = Number(withColon[1]);
    const min = Number(withColon[2]);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return minutesToHm(h * 60 + min);
    }
    return null;
  }
  const compact = t.match(/^(\d{2})(\d{2})$/);
  if (compact) {
    const h = Number(compact[1]);
    const min = Number(compact[2]);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return minutesToHm(h * 60 + min);
    }
  }
  return null;
}

export type TimeInput24Props = Omit<InputProps, "type" | "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

/** Поле времени в формате 24 ч: нативный выбор + ручной ввод HH:mm. */
export const TimeInput24 = React.forwardRef<HTMLInputElement, TimeInput24Props>(
  ({ className, value, onChange, onBlur, onFocus, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null);
    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    const displayValue = React.useMemo(() => {
      const normalized = normalizeTimeInput24(value);
      return normalized ?? value;
    }, [value]);

    const openPicker = () => {
      const el = innerRef.current;
      if (!el) return;
      el.focus();
      if (typeof el.showPicker === "function") {
        try {
          el.showPicker();
        } catch {
          /* showPicker может бросить, если не user gesture */
        }
      }
    };

    return (
      <div className={cn("relative w-full max-w-[12rem]", className)}>
        <Input
          ref={setRefs}
          type="time"
          step={300}
          lang="ru-RU"
          autoComplete="off"
          className="w-full pr-9 font-mono tabular-nums [&::-webkit-calendar-picker-indicator]:opacity-0"
          value={displayValue}
          onChange={(e) => {
            const normalized = normalizeTimeInput24(e.target.value);
            onChange(normalized ?? e.target.value);
          }}
          onBlur={(e) => {
            const normalized = normalizeTimeInput24(e.target.value);
            if (normalized) onChange(normalized);
            onBlur?.(e);
          }}
          onFocus={onFocus}
          aria-label={props["aria-label"] ?? "Время, формат 24 часа"}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={openPicker}
          aria-label="Выбрать время"
        >
          <Clock className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  },
);
TimeInput24.displayName = "TimeInput24";
