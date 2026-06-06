"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { ClientInstructorEventDTO } from "@/lib/instructor-events";
import { formatEventPriceRu, formatSlotTimeRu } from "@/lib/instructor-events";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { LegalConsentCheckbox } from "@/shared/legal/legal-consent-checkbox";
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

  const register = useMutation({
    mutationFn: async (slotId: string) => {
      const r = await fetch(`/api/client/events/${event.id}/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId, acceptLegal: true }),
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

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-foreground">Выберите время выхода</p>
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
          const timeLabel = formatSlotTimeRu(slot.startsAt);
          const priceLabel = formatEventPriceRu(slot.priceRub);
          const seats =
            slot.maxSeats != null
              ? booked
                ? "Вы записаны"
                : slot.isFull
                  ? "Мест нет"
                  : `Осталось ${slot.spotsLeft ?? 0} из ${slot.maxSeats}`
              : booked
                ? "Вы записаны"
                : `${slot.paidCount} записано`;

          return (
            <li
              key={slot.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5",
                booked
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : slot.registrationOpen
                    ? "border-border bg-card"
                    : "border-muted bg-muted/30 opacity-75",
              )}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">{timeLabel}</span>
                  <span className="text-xs text-muted-foreground">{priceLabel}</span>
                  {!slot.isFree ? (
                    <span className="text-[10px] text-muted-foreground">· оплата после</span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{seats}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
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
                  </>
                ) : slot.registrationOpen ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="accent"
                    disabled={register.isPending || !acceptLegal}
                    onClick={() => register.mutate(slot.id)}
                  >
                    {register.isPending ? "…" : "Записаться"}
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
