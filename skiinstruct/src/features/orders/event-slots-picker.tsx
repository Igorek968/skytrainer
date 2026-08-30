"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { ClientInstructorEventDTO } from "@/lib/instructor-events";
import { formatEventPriceRu, formatSlotLineRu } from "@/lib/instructor-events";
import { EVENT_PARTY_MAX_PEOPLE, formatEventPartyRu, formatSeatCountRu } from "@/lib/event-party";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { LegalConsentCheckbox } from "@/shared/legal/legal-consent-checkbox";
import { CancelRegistrationButton } from "@/features/orders/cancel-registration-button";
import { QuantityStepper } from "@/features/orders/event-party-fields";
import { cn } from "@/lib/utils";

type RegisterResponse = {
  error?: string;
  checkoutUrl?: string | null;
  message?: string;
  registration?: { id: string } | null;
  registrationPath?: string;
};

function registrationHref(reg: { id: string } | null | undefined, path?: string): string | null {
  if (path) return path;
  if (reg?.id) return `/client/registrations/${reg.id}`;
  return null;
}

export function EventSlotsPicker({
  event,
  queryKey,
}: {
  event: ClientInstructorEventDTO;
  queryKey: string[];
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const [acceptLegal, setAcceptLegal] = useState(false);
  const openSlots = event.slots.filter((s) => !s.isCompleted);
  const bookable = openSlots.filter((s) => {
    const my = s.myRegistration;
    const booked = my && (my.status === "PAID" || my.status === "PENDING_PAYMENT");
    return s.registrationOpen && !booked;
  });
  const defaultQty = bookable.length === 1 ? 1 : 0;
  const [qtyBySlot, setQtyBySlot] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const s of bookable) init[s.id] = defaultQty;
    return init;
  });

  const cart = useMemo(() => {
    return bookable
      .map((slot) => {
        const max =
          slot.spotsLeft != null
            ? Math.min(EVENT_PARTY_MAX_PEOPLE, Math.max(0, slot.spotsLeft))
            : EVENT_PARTY_MAX_PEOPLE;
        const qty = Math.min(max, Math.max(0, qtyBySlot[slot.id] ?? 0));
        const unit = slot.priceRub;
        const lineRub = unit != null && unit > 0 ? unit * qty : 0;
        return { slot, qty, max, unit, lineRub };
      })
      .filter((row) => row.qty > 0);
  }, [bookable, qtyBySlot]);

  const totalRub = cart.reduce((sum, row) => sum + row.lineRub, 0);
  const totalSeats = cart.reduce((sum, row) => sum + row.qty, 0);

  const register = useMutation({
    mutationFn: async () => {
      if (!cart.length) throw new Error("Укажите число мест хотя бы на одном тарифе");
      const r = await fetch(`/api/client/events/${event.id}/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptLegal: true,
          items: cart.map((row) => ({ slotId: row.slot.id, quantity: row.qty })),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as RegisterResponse;
      if (!r.ok) {
        const href = registrationHref(j.registration, j.registrationPath);
        const err = new Error(
          typeof j.error === "string" ? j.error : "Не удалось записаться",
        ) as Error & { registrationPath?: string };
        if (href) err.registrationPath = href;
        throw err;
      }
      return j;
    },
    onSuccess: async (j) => {
      await qc.invalidateQueries({ queryKey });
      await qc.invalidateQueries({ queryKey: ["client-registrations"] });
      await qc.invalidateQueries({ queryKey: ["client-events"] });
      if (j.checkoutUrl) {
        toast.message(j.message ?? "Переход к оплате…");
        if (j.checkoutUrl.includes("/client/registrations/")) {
          router.push(j.checkoutUrl.replace(/^https?:\/\/[^/]+/, "") || j.checkoutUrl);
        } else {
          window.location.href = j.checkoutUrl;
        }
        return;
      }
      toast.success(j.message ?? "Вы записаны");
      const href = registrationHref(j.registration, j.registrationPath);
      if (href) router.push(href);
    },
    onError: (e: Error & { registrationPath?: string }) => {
      toast.error(e.message);
      if (e.registrationPath) router.push(e.registrationPath);
    },
  });

  if (!openSlots.length) {
    return <p className="mt-2 text-xs text-muted-foreground">Все выходы уже прошли</p>;
  }

  return (
    <div
      className="mt-3 space-y-3"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-medium text-foreground">Выберите тариф и число мест</p>
      <p className="text-[11px] text-muted-foreground">
        Можно взять несколько тарифов сразу — например 4 взрослых и 1 ребёнок. Оплата одним платежом.
      </p>
      <ul className="space-y-2">
        {openSlots.map((slot) => {
          const my = slot.myRegistration;
          const booked = Boolean(my && (my.status === "PAID" || my.status === "PENDING_PAYMENT"));
          const max =
            slot.spotsLeft != null
              ? Math.min(EVENT_PARTY_MAX_PEOPLE, Math.max(0, slot.spotsLeft))
              : EVENT_PARTY_MAX_PEOPLE;
          const qty = booked ? 0 : Math.min(max, Math.max(0, qtyBySlot[slot.id] ?? 0));
          const unit = slot.priceRub;
          const lineRub = unit != null && unit > 0 ? unit * qty : 0;
          const line = formatSlotLineRu(slot.startsAt, {
            title: slot.title,
            priceRub: booked && my ? my.amountRub : unit,
            includePrice: booked,
          });
          const seatsLine = booked
            ? `${formatEventPartyRu(my)} · вы записаны`
            : slot.maxSeats != null
              ? slot.isFull
                ? "Мест нет"
                : `Осталось ${slot.spotsLeft ?? 0} из ${slot.maxSeats}`
              : `${slot.paidCount} записано`;

          return (
            <li
              key={slot.id}
              className={cn(
                "space-y-2 rounded-md border px-3 py-2.5",
                booked
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : slot.registrationOpen
                    ? "border-border bg-card"
                    : "border-muted bg-muted/30 opacity-75",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{line}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {seatsLine}
                    {!booked && unit != null && unit > 0
                      ? ` · ${formatEventPriceRu(unit)} / чел.`
                      : null}
                    {!booked && slot.isFree ? " · бесплатно" : null}
                  </p>
                </div>
                {booked ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      Записаны
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/client/registrations/${my!.id}`)}
                    >
                      Заявка
                    </Button>
                    {!slot.isCompleted ? (
                      <CancelRegistrationButton
                        registrationId={my!.id}
                        size="sm"
                        onCancelled={async () => {
                          await qc.invalidateQueries({ queryKey });
                          await qc.invalidateQueries({ queryKey: ["client-registrations"] });
                          await qc.invalidateQueries({ queryKey: ["client-events"] });
                        }}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
              {!booked && slot.registrationOpen ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
                  <QuantityStepper
                    id={`slot-qty-${slot.id}`}
                    label="Мест"
                    value={qty}
                    min={0}
                    max={Math.max(0, max)}
                    disabled={register.isPending || max < 1}
                    onChange={(next) =>
                      setQtyBySlot((prev) => ({ ...prev, [slot.id]: next }))
                    }
                  />
                  <p className="text-sm font-semibold tabular-nums">
                    {qty < 1
                      ? "—"
                      : slot.isFree
                        ? "Бесплатно"
                        : formatEventPriceRu(lineRub)}
                  </p>
                </div>
              ) : !booked ? (
                <p className="text-xs text-muted-foreground">Недоступно</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {bookable.length > 0 ? (
        <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
          <LegalConsentCheckbox
            id={`event-slots-legal-${event.id}`}
            checked={acceptLegal}
            onChange={setAcceptLegal}
            className="text-xs"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              <span className="text-muted-foreground">Итого</span>{" "}
              <span className="font-semibold tabular-nums">
                {totalSeats < 1
                  ? "—"
                  : totalRub > 0
                    ? formatEventPriceRu(totalRub)
                    : "Бесплатно"}
              </span>
              {totalSeats > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {" "}
                  · {formatSeatCountRu(totalSeats)}
                </span>
              ) : null}
            </p>
            <Button
              type="button"
              size="sm"
              variant="accent"
              disabled={register.isPending || !acceptLegal || totalSeats < 1}
              onClick={() => register.mutate()}
            >
              {register.isPending
                ? "…"
                : totalRub > 0
                  ? `Оплатить ${totalRub.toLocaleString("ru-RU")} ₽`
                  : "Записаться"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
