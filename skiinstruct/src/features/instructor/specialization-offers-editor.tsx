"use client";

import { X } from "lucide-react";

import type { SpecializationOffer } from "@/lib/instructor-specialization-offers";
import { INSTRUCTOR_ACTIVITY_LABELS } from "@/lib/services/instructor-match";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

type Props = {
  offers: SpecializationOffer[];
  onChange: (next: SpecializationOffer[]) => void;
  error?: string;
};

export function SpecializationOffersEditor({ offers, onChange, error }: Props) {
  const selectedLabels = new Set(offers.map((o) => o.label));
  const canAdd = INSTRUCTOR_ACTIVITY_LABELS.filter((l) => !selectedLabels.has(l));

  const add = (label: string) => {
    if (selectedLabels.has(label)) return;
    onChange([
      ...offers,
      {
        label,
        hourlyRate: offers[0]?.hourlyRate ?? 2500,
        lessonsCompleted: 0,
      },
    ]);
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

  const totalLessons = offers.reduce((s, o) => s + o.lessonsCompleted, 0);

  return (
    <div className="space-y-3">
      <div>
        <Label>Направления и цены</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Добавьте вид спорта и укажите ставку ₽/час для каждого. Клиент увидит цену и число занятий по
          выбранному направлению.
        </p>
      </div>

      {offers.length ? (
        <ul className="space-y-2">
          {offers.map((o) => (
            <li
              key={o.label}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/20 p-2"
            >
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
