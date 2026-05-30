"use client";

import { X } from "lucide-react";

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
import { INSTRUCTOR_ACTIVITY_LABELS } from "@/lib/services/instructor-match";
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
  const selectedLabels = new Set(offers.map((o) => o.label));
  const canAdd = INSTRUCTOR_ACTIVITY_LABELS.filter((l) => !selectedLabels.has(l));

  const add = (label: string) => {
    if (selectedLabels.has(label)) return;
    const row: SpecializationOffer = {
      label,
      hourlyRate: offers[0]?.hourlyRate ?? 2500,
      lessonsCompleted: 0,
    };
    if (label === AUTO_INSTRUCTOR_LABEL || isAutoInstructorLabel(label)) {
      row.drivingDetails = defaultDrivingSchoolDetails();
    }
    onChange([...offers, row]);
  };

  const remove = (label: string) => {
    onChange(offers.filter((o) => o.label !== label));
  };

  const updateRate = (label: string, hourlyRate: number) => {
    onChange(
      offers.map((o) =>
        o.label === label ? { ...o, hourlyRate: Math.max(500, Math.round(hourlyRate) || 500) } : o,
      ),
    );
  };

  const updateDrivingDetails = (label: string, drivingDetails: DrivingSchoolOfferDetails) => {
    onChange(offers.map((o) => (o.label === label ? { ...o, drivingDetails } : o)));
  };

  const totalLessons = offers.reduce((s, o) => s + o.lessonsCompleted, 0);

  return (
    <div className="space-y-3">
      <div>
        <Label>Направления и цены</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Добавьте вид спорта и укажите ставку ₽/час для каждого. Для «Автоинструктора» появятся поля про
          авто, КПП и категории прав.
        </p>
      </div>

      {offers.length ? (
        <ul className="space-y-2">
          {offers.map((o) => (
            <li
              key={o.label}
              className="rounded-md border border-border bg-muted/20 p-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-[10rem] flex-1 text-sm font-medium">{o.label}</span>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`rate-${o.label}`} className="sr-only">
                    Цена за час
                  </Label>
                  <Input
                    id={`rate-${o.label}`}
                    type="number"
                    min={500}
                    step={100}
                    className="h-9 w-28"
                    value={o.hourlyRate}
                    onChange={(e) => updateRate(o.label, Number(e.target.value) || 500)}
                  />
                  <span className="text-xs text-muted-foreground">₽/ч</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Занятий: <strong className="text-foreground">{o.lessonsCompleted}</strong>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => remove(o.label)}
                  aria-label={`Убрать ${o.label}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {isAutoInstructorLabel(o.label) ? (
                <DrivingDetailsFields
                  details={o.drivingDetails ?? defaultDrivingSchoolDetails()}
                  onChange={(next) => updateDrivingDetails(o.label, next)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Добавьте хотя бы одно направление.</p>
      )}

      {canAdd.length ? (
        <div className="flex flex-wrap gap-2">
          {canAdd.map((label) => (
            <Button key={label} type="button" variant="outline" size="sm" onClick={() => add(label)}>
              + {label}
            </Button>
          ))}
        </div>
      ) : null}

      {offers.length ? (
        <p className="text-xs text-muted-foreground">
          Всего занятий по направлениям (считается автоматически после завершённых заказов): {totalLessons}
        </p>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
