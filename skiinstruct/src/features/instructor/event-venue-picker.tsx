"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { EventVenueMapLazy } from "@/features/map/map-loader";
import { useMeetPoint } from "@/features/map/use-client-meet-point";
import { geocodeReverseParts, geocodeSearchQuery } from "@/features/map/meet-geocode-client";
import { FALLBACK_MAP_CITY } from "@/lib/map-city-centers";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export type EventVenueValue = {
  address: string;
  lat: number | null;
  lng: number | null;
};

export function EventVenuePicker({
  value,
  onChange,
  disabled,
  mapFirst = false,
}: {
  value: EventVenueValue;
  onChange: (next: EventVenueValue) => void;
  disabled?: boolean;
  /** Карта сверху, адрес ниже (удобно для админки: клик → автозаполнение адреса). */
  mapFirst?: boolean;
}) {
  const [searchLoading, setSearchLoading] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const reverseReqId = useRef(0);
  const meetLat = useMeetPoint((s) => s.meetLat);
  const meetLng = useMeetPoint((s) => s.meetLng);
  const lat = value.lat ?? meetLat ?? FALLBACK_MAP_CITY.lat;
  const lng = value.lng ?? meetLng ?? FALLBACK_MAP_CITY.lng;

  async function fillAddressFromCoords(nextLat: number, nextLng: number, keepAddress?: string) {
    const requestId = ++reverseReqId.current;
    setReverseLoading(true);
    onChange({
      address: keepAddress ?? value.address,
      lat: nextLat,
      lng: nextLng,
    });
    try {
      const result = await geocodeReverseParts(nextLat, nextLng);
      if (requestId !== reverseReqId.current) return;
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      onChange({
        address: result.displayName,
        lat: nextLat,
        lng: nextLng,
      });
    } catch {
      if (requestId !== reverseReqId.current) return;
      toast.error("Не удалось определить адрес");
    } finally {
      if (requestId === reverseReqId.current) setReverseLoading(false);
    }
  }

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
      reverseReqId.current += 1;
      onChange({ address: result.displayName, lat: result.lat, lng: result.lng });
      toast.success("Точка на карте обновлена");
    } catch {
      toast.error("Сеть недоступна. Проверьте соединение и повторите.");
    } finally {
      setSearchLoading(false);
    }
  }

  function handleMapChange(nextLat: number, nextLng: number) {
    void fillAddressFromCoords(nextLat, nextLng, "");
  }

  const loading = searchLoading || reverseLoading;

  const addressBlock = (
    <div className="space-y-2">
      <Label htmlFor="event-venue-address">Адрес мероприятия</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="event-venue-address"
          value={value.address}
          onChange={(e) => {
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
    </div>
  );

  const mapBlock = (
    <EventVenueMapLazy
      lat={lat}
      lng={lng}
      interactive={!disabled}
      onPositionChange={disabled ? undefined : handleMapChange}
    />
  );

  return (
    <div className="space-y-2">
      {mapFirst ? (
        <>
          {mapBlock}
          <p className="text-xs text-muted-foreground">
            Кликните по карте, чтобы поставить точку — адрес заполнится автоматически.
            {reverseLoading ? " Определяем адрес…" : null}
          </p>
          {addressBlock}
        </>
      ) : (
        <>
          {addressBlock}
          {mapBlock}
          <p className="text-xs text-muted-foreground">
            Укажите адрес и нажмите «Найти», либо выберите точку на карте — клиенты увидят место
            проведения.
            {!value.address.trim() ? " Поле необязательное." : null}
          </p>
        </>
      )}
    </div>
  );
}
