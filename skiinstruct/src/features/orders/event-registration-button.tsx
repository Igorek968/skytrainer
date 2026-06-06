"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import type { ClientInstructorEventDTO } from "@/lib/instructor-events";
import { formatEventPriceRu } from "@/lib/instructor-events";
import { EventSlotsPicker } from "@/features/orders/event-slots-picker";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

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

  const register = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/client/events/${event.id}/register`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json().catch(() => ({}))) as RegisterResponse;
      if (!r.ok) {
        const href = registrationHref(j.registration, j.registrationPath);
        const err = new Error(
          typeof j.error === "string" ? j.error : "Не удалось записаться на мероприятие",
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
    const paidEvent = !event.isFree && my.amountRub > 0;
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {paidEvent ? "Подтвердите участие и оплатите" : "Подтвердите участие"}
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
            : paidEvent
              ? "Подтвердить и оплатить"
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
              ? "Записаны · оплата после мероприятия"
              : "Вы записаны"}
        </Badge>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => router.push(`/client/registrations/${my.id}`)}
        >
          Открыть заявку
        </Button>
      </div>
    );
  }

  if (!event.registrationOpen) {
    if (event.isCompleted) {
      return <p className="mt-2 text-xs text-muted-foreground">Мероприятие уже прошло</p>;
    }
    if (event.spotsLeft === 0) {
      return <p className="mt-2 text-xs text-muted-foreground">Мест нет</p>;
    }
    return null;
  }

  const priceLabel = formatEventPriceRu(event.priceRub);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-foreground">{priceLabel}</span>
      {!event.isFree ? (
        <span className="text-xs text-muted-foreground">Оплата после мероприятия</span>
      ) : null}
      {event.spotsLeft != null ? (
        <span className="text-xs text-muted-foreground">Осталось мест: {event.spotsLeft}</span>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="accent"
        disabled={register.isPending}
        onClick={() => register.mutate()}
      >
        {register.isPending ? "Оформляем…" : "Записаться"}
      </Button>
    </div>
  );
}
