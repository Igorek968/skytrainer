"use client";

import type { ReactNode } from "react";

import { MAP_CITY_CENTERS } from "@/lib/map-city-centers";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";

export type CatalogNavButtonVariant = "secondary" | "outline";

export type CatalogNavPanelDef<T extends string> = {
  id: T;
  label: string;
  variant?: CatalogNavButtonVariant;
};

type EventCatalogNavShellProps<T extends string> = {
  citySlug: string;
  cityName: string;
  citySelectId: string;
  onCityChange: (slug: string) => void;
  panels: readonly CatalogNavPanelDef<T>[];
  activePanel: T | null;
  onActivePanelChange: (panel: T | null) => void;
  panelLabels: Record<T, string>;
  children?: ReactNode;
  cityTitle?: string;
  cityDescription?: string;
  emptyHint?: string;
};

/**
 * Общий каркас каталога: город + кнопки-переходы в отдельный блок раздела.
 */
export function EventCatalogNavShell<T extends string>({
  citySlug,
  cityName,
  citySelectId,
  onCityChange,
  panels,
  activePanel,
  onActivePanelChange,
  panelLabels,
  children,
  cityTitle = "Город каталога",
  cityDescription = "Выберите город — карта создания и история карточек/событий переключаются на него.",
  emptyHint = "Выберите раздел выше, чтобы открыть его содержимым.",
}: EventCatalogNavShellProps<T>) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div>
            <CardTitle>{cityTitle}</CardTitle>
            <CardDescription>{cityDescription}</CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1.5 sm:min-w-[16rem]">
              <Label htmlFor={citySelectId}>Город</Label>
              <select
                id={citySelectId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={citySlug}
                onChange={(e) => onCityChange(e.target.value)}
              >
                {MAP_CITY_CENTERS.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              {panels.map((btn) => (
                <Button
                  key={btn.id}
                  type="button"
                  size="sm"
                  variant={activePanel === btn.id ? "accent" : (btn.variant ?? "outline")}
                  onClick={() => onActivePanelChange(btn.id)}
                >
                  {btn.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      {activePanel ? (
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onActivePanelChange(null)}
              >
                ← Назад
              </Button>
              <span className="text-xs text-muted-foreground">
                {cityName} · {panelLabels[activePanel]}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">{children}</CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      )}
    </div>
  );
}
