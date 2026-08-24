"use client";

import { Plus, X } from "lucide-react";
import { useRef, useState } from "react";

import {
  AUTO_INSTRUCTOR_LABEL,
  DRIVING_LICENSE_CATEGORIES,
  DRIVING_TRANSMISSION_OPTIONS,
  DRIVING_VEHICLE_OPTIONS,
  defaultDrivingSchoolDetails,
  isAutoInstructorLabel,
  type DrivingLicenseCategory,
  type DrivingSchoolOfferDetails,
  type DrivingTransmissionOption,
  type DrivingVehicleOption,
} from "@/lib/auto-instructor-offer";
import type { SpecializationOffer } from "@/lib/instructor-specialization-offers";
import {
  emptySpecializationOffer,
  normalizeInstructorActivityLabelInput,
} from "@/lib/instructor-specialization-offers";
import {
  isValidLessonHourlyRate,
  lessonHourlyRateError,
  LESSON_HOURLY_RATE_HINT_RU,
  LESSON_HOURLY_RATE_MIN_PAID_RUB,
  normalizeLessonHourlyRate,
} from "@/lib/event-price";
import {
  activityLabelSortKey,
  instructorActivityLabelsAlphabetical,
} from "@/lib/services/instructor-match";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  offers: SpecializationOffer[];
  onChange: (next: SpecializationOffer[]) => void;
  error?: string;
};

function toggleInList<T extends string>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function sportRowKey(label: string): string {
  return activityLabelSortKey(normalizeInstructorActivityLabelInput(label));
}

function SportLabelCombobox({
  id,
  value,
  takenKeys,
  suggestions,
  onChange,
  onCommit,
  inputRef,
}: {
  id: string;
  value: string;
  takenKeys: Set<string>;
  suggestions: string[];
  onChange: (next: string) => void;
  onCommit: (next: string) => void;
  inputRef?: (el: HTMLInputElement | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const q = activityLabelSortKey(value);
  const filtered = suggestions
    .filter((label) => {
      const key = sportRowKey(label);
      if (takenKeys.has(key) && key !== sportRowKey(value)) return false;
      if (!q) return true;
      return (
        activityLabelSortKey(label).includes(q) ||
        label.toLowerCase().includes(value.trim().toLowerCase())
      );
    })
    .slice(0, 40);

  return (
    <div className="relative">
      <Input
        id={id}
        ref={inputRef}
        placeholder="Например: горные лыжи или кайтсёрфинг"
        className="h-9"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
          onCommit(value);
        }}
      />
      {open && filtered.length > 0 ? (
        <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-background py-1 text-sm shadow-md">
          {filtered.map((label) => (
            <li key={label}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(label);
                  onCommit(label);
                  setOpen(false);
                }}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DrivingDetailsFields({
  details,
  onChange,
}: {
  details: DrivingSchoolOfferDetails;
  onChange: (next: DrivingSchoolOfferDetails) => void;
}) {
  const setVehicles = (id: DrivingVehicleOption) => {
    onChange({ ...details, vehicleOptions: toggleInList(details.vehicleOptions, id) });
  };
  const setTransmissions = (id: DrivingTransmissionOption) => {
    onChange({ ...details, transmissions: toggleInList(details.transmissions, id) });
  };
  const setCategories = (id: DrivingLicenseCategory) => {
    onChange({ ...details, licenseCategories: toggleInList(details.licenseCategories, id) });
  };

  return (
    <div className="mt-2 space-y-3 rounded-md border border-dashed border-border bg-background/80 p-3">
      <div className="space-y-1.5">
        <p className="text-xs font-medium">На чьём авто обучение</p>
        <div className="flex flex-wrap gap-1.5">
          {DRIVING_VEHICLE_OPTIONS.map((opt) => {
            const active = details.vehicleOptions.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setVehicles(opt.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-accent bg-accent/15 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium">Коробка передач</p>
        <div className="flex flex-wrap gap-1.5">
          {DRIVING_TRANSMISSION_OPTIONS.map((opt) => {
            const active = details.transmissions.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTransmissions(opt.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-accent bg-accent/15 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium">Категории прав</p>
        <div className="flex flex-wrap gap-1.5">
          {DRIVING_LICENSE_CATEGORIES.map((cat) => {
            const active = details.licenseCategories.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                title={cat.hint ?? undefined}
                onClick={() => setCategories(cat.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-accent bg-accent/15 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {cat.label}
                {cat.hint ? (
                  <span className="ml-1 font-normal text-muted-foreground">· {cat.hint}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SpecializationOffersEditor({ offers, onChange, error }: Props) {
  const catalogSuggestions = instructorActivityLabelsAlphabetical();
  const rows = offers.length ? offers : [emptySpecializationOffer()];
  const sportInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const patchRow = (index: number, patch: Partial<SpecializationOffer>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const commitLabel = (index: number, raw: string) => {
    const label = normalizeInstructorActivityLabelInput(raw);
    const patch: Partial<SpecializationOffer> = { label };
    if (
      (label === AUTO_INSTRUCTOR_LABEL || isAutoInstructorLabel(label)) &&
      !rows[index]?.drivingDetails
    ) {
      patch.drivingDetails = defaultDrivingSchoolDetails();
    }
    patchRow(index, patch);
  };

  const addRow = () => {
    if (rows.length >= 12) return;
    const lastValidRate =
      [...rows].reverse().find((row) => isValidLessonHourlyRate(row.hourlyRate))?.hourlyRate ?? 2500;
    onChange([...rows, emptySpecializationOffer(lastValidRate)]);
    const nextIndex = rows.length;
    window.setTimeout(() => {
      sportInputRefs.current[nextIndex]?.focus();
    }, 0);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) {
      onChange([emptySpecializationOffer(rows[0]?.hourlyRate ?? 2500)]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  const totalLessons = rows.reduce((s, o) => s + (o.lessonsCompleted ?? 0), 0);

  return (
    <div className="space-y-3">
      <div>
        <Label>Направления и цены</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Можно указать до 12 дисциплин. Каждое направление — отдельная строка со своей ценой.
          Не выбирайте вторую дисциплину в том же списке: нажмите «Добавить направление».
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{LESSON_HOURLY_RATE_HINT_RU}.</p>
      </div>

      <ul className="space-y-2">
        {rows.map((o, index) => {
          const takenExceptCurrent = new Set(
            rows
              .filter((_, i) => i !== index)
              .map((row) => sportRowKey(row.label))
              .filter(Boolean),
          );
          const duplicate =
            Boolean(sportRowKey(o.label)) && takenExceptCurrent.has(sportRowKey(o.label));
          return (
            <li key={`offer-row-${index}`} className="overflow-visible rounded-md border border-border bg-muted/20 p-2">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-[12rem] flex-1 space-y-1">
                  <Label htmlFor={`sport-${index}`} className="sr-only">
                    Вид спорта
                  </Label>
                  <SportLabelCombobox
                    id={`sport-${index}`}
                    value={o.label}
                    takenKeys={takenExceptCurrent}
                    suggestions={catalogSuggestions}
                    onChange={(next) => patchRow(index, { label: next })}
                    onCommit={(next) => commitLabel(index, next)}
                    inputRef={(el) => {
                      sportInputRefs.current[index] = el;
                    }}
                  />
                  {duplicate ? (
                    <p className="text-[11px] text-destructive">Это направление уже добавлено</p>
                  ) : null}
                </div>
                <div className="flex min-h-[3.25rem] flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`rate-${index}`} className="sr-only">
                      Цена за час
                    </Label>
                    <Input
                      id={`rate-${index}`}
                      type="number"
                      inputMode="numeric"
                      min={LESSON_HOURLY_RATE_MIN_PAID_RUB}
                      step={1}
                      className={cn(
                        "h-9 w-28",
                        !isValidLessonHourlyRate(o.hourlyRate) &&
                          "border-destructive ring-1 ring-destructive focus-visible:ring-destructive",
                      )}
                      value={o.hourlyRate > 0 ? o.hourlyRate : ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (!raw) {
                          patchRow(index, { hourlyRate: 0 });
                          return;
                        }
                        patchRow(index, {
                          hourlyRate: normalizeLessonHourlyRate(Number(raw)),
                        });
                      }}
                      placeholder={`${LESSON_HOURLY_RATE_MIN_PAID_RUB}`}
                      title={LESSON_HOURLY_RATE_HINT_RU}
                      aria-invalid={!isValidLessonHourlyRate(o.hourlyRate)}
                    />
                    <span className="text-xs text-muted-foreground">₽/ч</span>
                  </div>
                  {!isValidLessonHourlyRate(o.hourlyRate) ? (
                    <p className="text-[11px] text-destructive">{lessonHourlyRateError(o.hourlyRate)}</p>
                  ) : (
                    <p className="text-[11px] text-transparent">.</p>
                  )}
                </div>
                {o.lessonsCompleted > 0 ? (
                  <span className="pt-2 text-xs text-muted-foreground">
                    Занятий: <strong className="text-foreground">{o.lessonsCompleted}</strong>
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-0.5 h-8 w-8 shrink-0"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => removeRow(index)}
                  aria-label="Убрать направление"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {isAutoInstructorLabel(o.label) ? (
                <DrivingDetailsFields
                  details={o.drivingDetails ?? defaultDrivingSchoolDetails()}
                  onChange={(next) => patchRow(index, { drivingDetails: next })}
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 w-full gap-1.5 sm:w-auto"
        disabled={rows.length >= 12}
        onMouseDown={(e) => e.preventDefault()}
        onClick={addRow}
      >
        <Plus className="h-4 w-4" />
        Добавить направление{rows.length > 0 ? ` (${rows.length} из 12)` : ""}
      </Button>

      {totalLessons > 0 ? (
        <p className="text-xs text-muted-foreground">
          Всего занятий по направлениям (после завершённых заказов): {totalLessons}
        </p>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
