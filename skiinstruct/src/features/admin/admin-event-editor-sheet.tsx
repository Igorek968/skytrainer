"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { eventCategoryOptions } from "@/lib/event-category";
import type { InstructorEventSlotForm } from "@/lib/instructor-events";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

type Props = {
  eventId: string;
  onClose: () => void;
};

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdminEventEditorSheet({ eventId, onClose }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [priceRub, setPriceRub] = useState("");
  const [maxReg, setMaxReg] = useState("");
  const [eventAtLocal, setEventAtLocal] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueLat, setVenueLat] = useState("");
  const [venueLng, setVenueLng] = useState("");
  const [slotTime, setSlotTime] = useState("10:00");
  const [slotDate, setSlotDate] = useState("");
  const [slots, setSlots] = useState<InstructorEventSlotForm[]>([]);

  const query = useQuery({
    queryKey: ["admin-event", eventId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/events/${eventId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Не удалось загрузить");
      return r.json() as Promise<{
        event: {
          id: string;
          title: string;
          body: string;
          category: string | null;
          priceRub: number | null;
          maxRegistrations: number | null;
          eventAt: string | null;
          venueAddress?: string | null;
          venueLat?: number | null;
          venueLng?: number | null;
          moderationStatus: string;
          slotInputs?: InstructorEventSlotForm[];
          instructor: { name: string | null; email: string };
        };
      }>;
    },
  });

  useEffect(() => {
    const ev = query.data?.event;
    if (!ev) return;
    setTitle(ev.title);
    setBody(ev.body);
    setCategory(ev.category ?? "");
    setPriceRub(ev.priceRub != null ? String(ev.priceRub) : "");
    setMaxReg(ev.maxRegistrations != null ? String(ev.maxRegistrations) : "");
    setEventAtLocal(toLocalInput(ev.eventAt));
    setVenueAddress(ev.venueAddress ?? "");
    setVenueLat(ev.venueLat != null ? String(ev.venueLat) : "");
    setVenueLng(ev.venueLng != null ? String(ev.venueLng) : "");
    setSlots(ev.slotInputs ?? []);
    if (ev.slotInputs?.[0]?.date) setSlotDate(ev.slotInputs[0].date);
    else if (ev.eventAt) setSlotDate(ev.eventAt.slice(0, 10));
  }, [query.data?.event]);

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          category: category || undefined,
          priceRub: priceRub.trim() ? Number(priceRub) : null,
          maxRegistrations: maxReg.trim() ? Number(maxReg) : null,
          eventAt: eventAtLocal ? new Date(eventAtLocal).toISOString() : null,
          venueAddress: venueAddress.trim() || null,
          venueLat: venueLat.trim() ? Number(venueLat) : null,
          venueLng: venueLng.trim() ? Number(venueLng) : null,
          ...(slots.length
            ? {
                slots: slots.map((s) => ({
                  id: s.id,
                  date: s.date,
                  time: s.time,
                  title: s.title,
                  maxSeats: s.maxSeats,
                  priceRub: s.priceRub,
                })),
                eventDay: slots[0]?.date || slotDate || undefined,
              }
            : {}),
        }),
      });
      const j = (await r.json()) as { error?: string | { formErrors?: string[] }; message?: string };
      if (!r.ok) {
        const err = j.error;
        throw new Error(
          typeof err === "string"
            ? err
            : err && typeof err === "object" && err.formErrors?.[0]
              ? err.formErrors[0]
              : "Ошибка сохранения",
        );
      }
      return j;
    },
    onSuccess: async (j) => {
      toast.success(j.message ?? "Сохранено");
      await qc.invalidateQueries({ queryKey: ["admin-pending-events"] });
      await qc.invalidateQueries({ queryKey: ["admin-event", eventId] });
      await qc.invalidateQueries({ queryKey: ["client-events"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (hard: boolean) => {
      const r = await fetch(`/api/admin/events/${eventId}${hard ? "?hard=1" : ""}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = (await r.json()) as { error?: string; message?: string };
      if (!r.ok) throw new Error(j.error ?? "Ошибка удаления");
      return j;
    },
    onSuccess: async (j) => {
      toast.success(j.message ?? "Готово");
      await qc.invalidateQueries({ queryKey: ["admin-pending-events"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background p-4 shadow-lg">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Редактирование события</h2>
            <p className="text-xs text-muted-foreground">
              {query.data?.event.instructor.name ?? query.data?.event.instructor.email ?? "…"}
            </p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>

        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : query.error ? (
          <p className="text-sm text-destructive">Не удалось загрузить событие.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              <Label htmlFor="ae-title">Название</Label>
              <Input id="ae-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ae-cat">Категория</Label>
              <select
                id="ae-cat"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">—</option>
                {eventCategoryOptions().map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ae-body">Описание</Label>
              <textarea
                id="ae-body"
                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="ae-price">Цена, ₽</Label>
                <Input
                  id="ae-price"
                  inputMode="numeric"
                  value={priceRub}
                  onChange={(e) => setPriceRub(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ae-max">Мест</Label>
                <Input
                  id="ae-max"
                  inputMode="numeric"
                  value={maxReg}
                  onChange={(e) => setMaxReg(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ae-at">Дата / время</Label>
              <Input
                id="ae-at"
                type="datetime-local"
                value={eventAtLocal}
                onChange={(e) => setEventAtLocal(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ae-addr">Адрес</Label>
              <Input
                id="ae-addr"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="ae-lat">Широта</Label>
                <Input id="ae-lat" value={venueLat} onChange={(e) => setVenueLat(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ae-lng">Долгота</Label>
                <Input id="ae-lng" value={venueLng} onChange={(e) => setVenueLng(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-border p-2">
              <p className="text-xs font-medium text-muted-foreground">Слоты (выходы)</p>
              {slots.length ? (
                <ul className="space-y-1 text-xs">
                  {slots.map((s, i) => (
                    <li key={`${s.id ?? i}-${s.time}`} className="flex items-center justify-between gap-2">
                      <span>
                        {s.date ?? "—"} {s.time}
                        {s.title ? ` · ${s.title}` : ""}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => setSlots((prev) => prev.filter((_, j) => j !== i))}
                      >
                        Удалить
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Слотов нет — можно добавить.</p>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Дата</Label>
                  <Input
                    type="date"
                    className="h-8 w-[140px]"
                    value={slotDate}
                    onChange={(e) => setSlotDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Время</Label>
                  <Input
                    className="h-8 w-[100px]"
                    value={slotTime}
                    onChange={(e) => setSlotTime(e.target.value)}
                    placeholder="10:00"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!slotDate || !/^\d{1,2}:\d{2}$/.test(slotTime.trim())) {
                      toast.error("Укажите дату и время ЧЧ:ММ");
                      return;
                    }
                    setSlots((prev) => [
                      ...prev,
                      {
                        date: slotDate,
                        time: slotTime.trim(),
                        maxSeats: maxReg.trim() ? Number(maxReg) : null,
                        priceRub: priceRub.trim() ? Number(priceRub) : null,
                      },
                    ]);
                  }}
                >
                  + слот
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="accent"
                disabled={save.isPending || !title.trim() || !body.trim()}
                onClick={() => save.mutate()}
              >
                Сохранить
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={remove.isPending}
                onClick={() => {
                  if (confirm("Снять с публикации / архивировать?")) remove.mutate(false);
                }}
              >
                Снять с публикации
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={remove.isPending}
                onClick={() => {
                  if (confirm("Удалить событие безвозвратно?")) remove.mutate(true);
                }}
              >
                Удалить
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
