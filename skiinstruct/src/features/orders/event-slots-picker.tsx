"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { ClientInstructorEventDTO } from "@/lib/instructor-events";
import { formatEventPriceRu, formatSlotLineRu } from "@/lib/instructor-events";
import { eventPartyError, eventRegistrationSeatCount, formatEventPartyRu } from "@/lib/event-party";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { LegalConsentCheckbox } from "@/shared/legal/legal-consent-checkbox";
import { CancelRegistrationButton } from "@/features/orders/cancel-registration-button";
import { EventPartyFields } from "@/features/orders/event-party-fields";
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
  const [adultCount, setAdultCount] = useState(1);
  const [childCount, setChildCount] = useState(0);
  const seats = eventRegistrationSeatCount({ adultCount, childCount });

  const register = useMutation({
    mutationFn: async (slotId: string) => {
      const partyErr = eventPartyError({ adultCount, childCount });
      if (partyErr) throw new Error(partyErr);
      const r = await fetch(`/api/client/events/${event.id}/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId, acceptLegal: true, adultCount, childCount }),
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

  const openSlots = event.slots.filter((s) => !s.isCompleted);
  if (!openSlots.length) {
    return <p className="mt-2 text-xs text-muted-foreground">Все выходы уже прошли</p>;
  }

  const anyOpen = openSlots.some((s) => {
    const my = s.myRegistration;
    const booked = my && (my.status === "PAID" || my.status === "PENDING_PAYMENT");
    return s.registrationOpen && !booked;
  });

  return (
    <div
      className="mt-3 space-y-2"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-medium text-foreground">Выберите день события</p>
      {anyOpen ? (
        <>
          <EventPartyFields
            idPrefix={`event-party-${event.id}`}
            adultCount={adultCount}
            childCount={childCount}
            onAdultCount={setAdultCount}
            onChildCount={setChildCount}
            disabled={register.isPending}
          />
          <p className="text-[11px] text-muted-foreground">
            Цена выбранного тарифа умножается на число человек. Если взрослый и ребёнок по разным
            тарифам — оформите две записи.
          </p>
        </>
      ) : null}
      <LegalConsentCheckbox
        id={`event-slots-legal-${event.id}`}
        checked={acceptLegal}
        onChange={setAcceptLegal}
        className="text-xs"
      />
      <ul className="space-y-2">
        {openSlots.map((slot) => {
          const my = slot.myRegistration;
          const booked =
            my && (my.status === "PAID" || my.status === "PENDING_PAYMENT");
          const unit = slot.priceRub;
          const totalRub =
            unit != null && unit > 0 ? unit * seats : unit ?? 0;
          const line = formatSlotLineRu(slot.startsAt, {
            title: slot.title,
            priceRub: booked ? my.amountRub : totalRub,
            includePrice: true,
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
                "flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2.5",
                booked
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : slot.registrationOpen
                    ? "border-border bg-card"
                    : "border-muted bg-muted/30 opacity-75",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-snug">{line}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {seatsLine}
                  {!booked && !slot.isFree ? " · оплата при записи" : null}
                  {!booked && seats > 1 && unit != null && unit > 0
                    ? ` · ${formatEventPriceRu(unit)} × ${seats}`
                    : null}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {booked ? (
                  <>
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
                  </>
                ) : slot.registrationOpen ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="accent"
                    disabled={register.isPending || !acceptLegal || seats < 1}
                    onClick={() => register.mutate(slot.id)}
                  >
                    {register.isPending
                      ? "…"
                      : slot.isFree
                        ? "Записаться"
                        : `Оплатить${totalRub > 0 ? ` ${totalRub.toLocaleString("ru-RU")} ₽` : ""}`}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Недоступно</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
