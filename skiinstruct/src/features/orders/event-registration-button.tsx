"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import type { ClientInstructorEventDTO } from "@/lib/instructor-events";
import {
  formatEventPriceRu,
  registrationStatusLabel,
} from "@/lib/instructor-events";
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

      if (j.checkoutUrl) {
        if (j.checkoutUrl.includes("/client/registrations/")) {
          router.push(j.checkoutUrl.replace(/^https?:\/\/[^/]+/, "") || j.checkoutUrl);
        } else {
          window.location.href = j.checkoutUrl;
        }
        return;
      }

      toast.success(j.message ?? "Вы записаны");
      if (href) router.push(href);
    },
    onError: (e: Error & { registrationPath?: string }) => {
      toast.error(e.message);
      if (e.registrationPath) {
        router.push(`${e.registrationPath}?pay=1`);
      }
    },
  });

  if (!isClient) return null;

  const my = event.myRegistration;

  if (my?.status === "PAID") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          Вы записаны
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

  if (my?.status === "PENDING_PAYMENT") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {registrationStatusLabel(my.status)}
        </Badge>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => router.push(`/client/registrations/${my.id}`)}
        >
          Оформить заявку
        </Button>
        <Button
          type="button"
          size="sm"
          variant="accent"
          disabled={register.isPending}
          onClick={() => register.mutate()}
        >
          {register.isPending ? "…" : "Оплатить запись"}
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
        {register.isPending
          ? "Оформляем…"
          : event.isFree
            ? "Записаться"
            : `Записаться · ${priceLabel}`}
      </Button>
    </div>
  );
}
