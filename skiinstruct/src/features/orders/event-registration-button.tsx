"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";

import type { ClientInstructorEventDTO } from "@/lib/instructor-events";
import { formatEventPriceRu } from "@/lib/instructor-events";
import { CancelRegistrationButton } from "@/features/orders/cancel-registration-button";
import { EventQuantityField } from "@/features/orders/event-party-fields";
import { EventSlotsPicker } from "@/features/orders/event-slots-picker";
import { eventPartyError, formatEventPartyRu } from "@/lib/event-party";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { LegalConsentCheckbox } from "@/shared/legal/legal-consent-checkbox";

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

export function EventRegistrationButton({
  event,
  queryKey,
}: {
  event: ClientInstructorEventDTO;
  queryKey: string[];
}) {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const router = useRouter();
  const isClient = session?.user?.role === "CLIENT";
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const register = useMutation({
    mutationFn: async () => {
      const partyErr = eventPartyError({ adultCount: quantity, childCount: 0 });
      if (partyErr) throw new Error(partyErr);
      const r = await fetch(`/api/client/events/${event.id}/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptLegal: true, adultCount: quantity, childCount: 0 }),
      });
      const j = (await r.json().catch(() => ({}))) as RegisterResponse;
      if (!r.ok) {
        const href = registrationHref(j.registration, j.registrationPath);
        const err = new Error(
          typeof j.error === "string" ? j.error : "Не удалось записаться на событие",
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

      const href = registrationHref(j.registration, j.registrationPath);
      toast.success(j.message ?? "Вы записаны");
      if (href) router.push(href);
    },
    onError: (e: Error & { registrationPath?: string }) => {
      toast.error(e.message);
      if (e.registrationPath) router.push(e.registrationPath);
    },
  });

  const confirmAttendance = useMutation({
    mutationFn: async (registrationId: string) => {
      const r = await fetch(`/api/client/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "confirm_attendance" }),
      });
      const j = (await r.json().catch(() => ({}))) as RegisterResponse;
      if (!r.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Не удалось подтвердить участие");
      }
      return j;
    },
    onSuccess: async (j) => {
      await qc.invalidateQueries({ queryKey });
      await qc.invalidateQueries({ queryKey: ["client-events"] });
      if (j.checkoutUrl) {
        if (j.checkoutUrl.includes("/client/registrations/")) {
          router.push(j.checkoutUrl.replace(/^https?:\/\/[^/]+/, "") || j.checkoutUrl);
        } else {
          window.location.href = j.checkoutUrl;
        }
        return;
      }
      toast.success(j.message ?? "Участие подтверждено");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isClient) return null;

  if (event.hasSlots && event.slots.length > 0) {
    return <EventSlotsPicker event={event} queryKey={queryKey} />;
  }

  const my = event.myRegistration;

  if (my?.needsAttendanceConfirmation) {
    const unpaid = !event.isFree && my.amountRub > 0 && my.status === "PENDING_PAYMENT";
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {unpaid ? "Оплатите запись" : "Подтвердите участие"}
        </Badge>
        <Button
          type="button"
          size="sm"
          variant="accent"
          disabled={confirmAttendance.isPending}
          onClick={() => confirmAttendance.mutate(my.id)}
        >
          {confirmAttendance.isPending
            ? "…"
            : unpaid
              ? "Оплатить"
              : "Подтвердить участие"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => router.push(`/client/registrations/${my.id}`)}
        >
          Заявка
        </Button>
        {!event.isCompleted ? (
          <CancelRegistrationButton
            registrationId={my.id}
            size="sm"
            onCancelled={async () => {
              await qc.invalidateQueries({ queryKey });
              await qc.invalidateQueries({ queryKey: ["client-registrations"] });
              await qc.invalidateQueries({ queryKey: ["client-events"] });
            }}
          />
        ) : null}
      </div>
    );
  }

  if (my && (my.status === "PAID" || my.status === "PENDING_PAYMENT")) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {my.attendanceConfirmedAt
            ? "Участие подтверждено"
            : my.status === "PENDING_PAYMENT" && !event.isFree
              ? "Ожидает оплаты"
              : "Вы записаны"}
        </Badge>
        <span className="text-xs text-muted-foreground">{formatEventPartyRu(my)}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => router.push(`/client/registrations/${my.id}`)}
        >
          Открыть заявку
        </Button>
        {!event.isCompleted ? (
          <CancelRegistrationButton
            registrationId={my.id}
            size="sm"
            onCancelled={async () => {
              await qc.invalidateQueries({ queryKey });
              await qc.invalidateQueries({ queryKey: ["client-registrations"] });
              await qc.invalidateQueries({ queryKey: ["client-events"] });
            }}
          />
        ) : null}
      </div>
    );
  }

  if (!event.registrationOpen) {
    if (event.isCompleted) {
      return <p className="mt-2 text-xs text-muted-foreground">Событие уже прошло</p>;
    }
    if (event.spotsLeft === 0) {
      return <p className="mt-2 text-xs text-muted-foreground">Мест нет</p>;
    }
    return null;
  }

  const unit = event.priceRub;
  const totalRub = unit != null && unit > 0 ? unit * quantity : unit ?? 0;
  const priceLabel = formatEventPriceRu(totalRub);

  return (
    <div
      className="mt-2 space-y-2"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
        <EventQuantityField
          id={`event-qty-${event.id}`}
          value={quantity}
          onChange={setQuantity}
          maxTotal={event.spotsLeft}
          disabled={register.isPending}
        />
        <p className="text-sm font-semibold tabular-nums">{priceLabel}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!event.isFree ? (
          <span className="text-xs text-muted-foreground">
            Оплата при записи
            {quantity > 1 && unit != null && unit > 0
              ? ` · ${formatEventPriceRu(unit)} × ${quantity}`
              : ""}
          </span>
        ) : null}
        {event.spotsLeft != null ? (
          <span className="text-xs text-muted-foreground">Осталось мест: {event.spotsLeft}</span>
        ) : null}
      </div>
      <LegalConsentCheckbox
        id={`event-legal-${event.id}`}
        checked={acceptLegal}
        onChange={setAcceptLegal}
        className="text-xs"
      />
      <Button
        type="button"
        size="sm"
        variant="accent"
        disabled={register.isPending || !acceptLegal || quantity < 1}
        onClick={() => register.mutate()}
      >
        {register.isPending ? "Оформляем…" : event.isFree ? "Записаться" : "Оплатить и записаться"}
      </Button>
    </div>
  );
}
