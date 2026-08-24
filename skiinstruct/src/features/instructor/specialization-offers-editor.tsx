"use client";

import { Plus, X } from "lucide-react";
import { useId } from "react";

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
  LESSON_HOURLY_RATE_HINT_RU,
  LESSON_HOURLY_RATE_MIN_PAID_RUB,
  normalizeLessonHourlyRate,
} from "@/lib/event-price";
import { instructorActivityLabelsAlphabetical } from "@/lib/services/instructor-match";
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
  const datalistId = useId();
  const catalogSuggestions = instructorActivityLabelsAlphabetical();
  const rows = offers.length ? offers : [emptySpecializationOffer()];

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
    onChange([...rows, emptySpecializationOffer(rows[0]?.hourlyRate ?? 2500)]);
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
          Укажите вид спорта и ставку ₽/час. Можно выбрать из подсказок или написать своё — после
          одобрения анкеты администратором направление появится в поиске у клиентов. Для
          «Автоинструктора» — дополнительные поля про авто, КПП и категории прав.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Минимальная стоимость: {LESSON_HOURLY_RATE_HINT_RU}.
        </p>
      </div>

      <ul className="space-y-2">
        {rows.map((o, index) => (
          <li key={`offer-row-${index}`} className="rounded-md border border-border bg-muted/20 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-[12rem] flex-1 space-y-1">
                <Label htmlFor={`sport-${index}`} className="sr-only">
                  Вид спорта
                </Label>
                <Input
                  id={`sport-${index}`}
                  list={datalistId}
                  placeholder="Например: горные лыжи или кайтсёрфинг"
                  className="h-9"
                  value={o.label}
                  onChange={(e) => patchRow(index, { label: e.target.value })}
                  onBlur={(e) => commitLabel(index, e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`rate-${index}`} className="sr-only">
                  Цена за час
                </Label>
                <Input
                  id={`rate-${index}`}
                  type="number"
                  min={0}
                  step={100}
                  className="h-9 w-28"
                  value={o.hourlyRate}
                  onChange={(e) =>
                    patchRow(index, {
                      hourlyRate: normalizeLessonHourlyRate(Number(e.target.value)),
                    })
                  }
                  placeholder={`0 / ${LESSON_HOURLY_RATE_MIN_PAID_RUB}+`}
                  title={LESSON_HOURLY_RATE_HINT_RU}
                />
                <span className="text-xs text-muted-foreground">₽/ч</span>
              </div>
              {o.lessonsCompleted > 0 ? (
                <span className="text-xs text-muted-foreground">
                  Занятий: <strong className="text-foreground">{o.lessonsCompleted}</strong>
                </span>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
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
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={rows.length >= 12}
        onClick={addRow}
      >
        <Plus className="h-4 w-4" />
        Добавить направление
      </Button>

      {totalLessons > 0 ? (
        <p className="text-xs text-muted-foreground">
          Всего занятий по направлениям (после завершённых заказов): {totalLessons}
        </p>
      ) : null}

      <datalist id={datalistId}>
        {catalogSuggestions.map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
