"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EventVenueMapLazy } from "@/features/map/map-loader";
import { geocodeReverseParts, geocodeSearchQuery } from "@/features/map/meet-geocode-client";
import { DEFAULT_SKI_RESORT_CENTER } from "@/lib/services/geo";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export type EventVenueValue = {
  address: string;
  lat: number | null;
  lng: number | null;
};

type CoordSource = "default" | "search" | "map";

export function EventVenuePicker({
  value,
  onChange,
  disabled,
}: {
  value: EventVenueValue;
  onChange: (next: EventVenueValue) => void;
  disabled?: boolean;
}) {
  const [searchLoading, setSearchLoading] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const coordSource = useRef<CoordSource>("default");
  const lat = value.lat ?? DEFAULT_SKI_RESORT_CENTER.lat;
  const lng = value.lng ?? DEFAULT_SKI_RESORT_CENTER.lng;

  useEffect(() => {
    if (coordSource.current === "search") return;
    if (value.lat == null || value.lng == null) return;
    if (coordSource.current !== "map") return;

    let cancelled = false;
    setReverseLoading(true);

    void geocodeReverseParts(value.lat, value.lng)
      .then((result) => {
        if (cancelled) return;
        if ("error" in result) return;
        onChange({ address: result.displayName, lat: value.lat, lng: value.lng });
      })
      .finally(() => {
        if (!cancelled) setReverseLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [value.lat, value.lng, onChange]);

  async function search() {
    const q = value.address.trim();
    if (q.length < 3) {
      toast.error("Введите адрес (не менее 3 символов)");
      return;
    }

    setSearchLoading(true);
    try {
      const result = await geocodeSearchQuery(q);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      coordSource.current = "search";
      onChange({ address: result.displayName, lat: result.lat, lng: result.lng });
      toast.success("Точка на карте обновлена");
    } catch {
      toast.error("Сеть недоступна. Проверьте соединение и повторите.");
    } finally {
      setSearchLoading(false);
    }
  }

  function handleMapChange(nextLat: number, nextLng: number) {
    coordSource.current = "map";
    onChange({ ...value, lat: nextLat, lng: nextLng });
  }

  const loading = searchLoading || reverseLoading;

  return (
    <div className="space-y-2">
      <Label htmlFor="event-venue-address">Адрес мероприятия</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="event-venue-address"
          value={value.address}
          onChange={(e) => {
            coordSource.current = "default";
            onChange({ ...value, address: e.target.value });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Например: Красная Поляна, ул. Олимпийская, 15"
          autoComplete="street-address"
          disabled={disabled || loading}
        />
        <Button
          type="button"
          variant="outline"
          className="shrink-0 sm:w-28"
          onClick={() => void search()}
          disabled={disabled || loading}
        >
          {searchLoading ? "Поиск…" : reverseLoading ? "Адрес…" : "Найти"}
        </Button>
      </div>
      <EventVenueMapLazy
        lat={lat}
        lng={lng}
        interactive={!disabled}
        onPositionChange={disabled ? undefined : handleMapChange}
      />
      <p className="text-xs text-muted-foreground">
        Укажите адрес и нажмите «Найти», либо выберите точку на карте — клиенты увидят место проведения.
        {!value.address.trim() ? " Поле необязательное." : null}
      </p>
    </div>
  );
}
