"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { geocodeReverseParts, geocodeSearchQuery } from "@/features/map/meet-geocode-client";
import { useMeetPoint } from "@/features/map/use-client-meet-point";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export function MeetAddressSearch() {
  const meetLat = useMeetPoint((s) => s.meetLat);
  const meetLng = useMeetPoint((s) => s.meetLng);
  const meetAddress = useMeetPoint((s) => s.meetAddress);
  const coordSource = useMeetPoint((s) => s.coordSource);
  const setMeet = useMeetPoint((s) => s.setMeet);
  const setMeetAddress = useMeetPoint((s) => s.setMeetAddress);

  const [searchLoading, setSearchLoading] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);

  useEffect(() => {
    if (coordSource === "search") return;

    let cancelled = false;
    setReverseLoading(true);

    void geocodeReverseParts(meetLat, meetLng)
      .then((result) => {
        if (cancelled) return;
        if ("error" in result) return;
        setMeetAddress(result.displayName);
      })
      .finally(() => {
        if (!cancelled) setReverseLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [meetLat, meetLng, coordSource, setMeetAddress]);

  async function search() {
    const q = meetAddress.trim();
    if (q.length < 3) {
      toast.error("Введите адрес места встречи (не менее 3 символов)");
      return;
    }

    setSearchLoading(true);
    try {
      const result = await geocodeSearchQuery(q);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setMeet(result.lat, result.lng, "search");
      setMeetAddress(result.displayName);
      toast.success("Точка встречи на карте обновлена");
    } catch {
      toast.error("Сеть недоступна. Проверьте соединение и повторите.");
    } finally {
      setSearchLoading(false);
    }
  }

  const loading = searchLoading || reverseLoading;

  return (
    <div className="space-y-2">
      <Label htmlFor="meet-address">Адрес места встречи</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="meet-address"
          value={meetAddress}
          onChange={(e) => setMeetAddress(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Например: Красная Поляна, ул. Олимпийская, 15"
          autoComplete="street-address"
          disabled={loading}
        />
        <Button type="button" className="shrink-0 sm:w-28" onClick={() => void search()} disabled={loading}>
          {searchLoading ? "Поиск…" : reverseLoading ? "Адрес…" : "Найти"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Введите адрес и нажмите «Найти» — маркер переместится. Клик по карте или перетаскивание маркера обновят адрес
        в строке.
      </p>
    </div>
  );
}
