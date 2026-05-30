"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useMeetPoint } from "@/features/map/use-client-meet-point";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export function MeetAddressSearch() {
  const setMeet = useMeetPoint((s) => s.setMeet);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  async function search() {
    const q = address.trim();
    if (q.length < 3) {
      toast.error("Введите адрес места встречи (не менее 3 символов)");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const payload = (await r.json()) as { error?: string; lat?: number; lng?: number; displayName?: string };
      if (!r.ok) {
        toast.error(typeof payload.error === "string" ? payload.error : "Не удалось найти адрес");
        return;
      }
      if (payload.lat == null || payload.lng == null) {
        toast.error("Не удалось определить координаты");
        return;
      }
      setMeet(payload.lat, payload.lng);
      if (payload.displayName) setAddress(payload.displayName);
      toast.success("Точка встречи на карте обновлена");
    } catch {
      toast.error("Сеть недоступна. Проверьте соединение и повторите.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="meet-address">Адрес места встречи</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="meet-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
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
          {loading ? "Поиск…" : "Найти"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Введите адрес и нажмите «Найти» — карта покажет это место. Можно также кликнуть по карте или перетащить
        маркер.
      </p>
    </div>
  );
}
