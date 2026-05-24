"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { CancelRegistrationButton } from "@/features/orders/cancel-registration-button";
import {
  clientRegistrationStatusLabel,
  type ClientRegistrationDetail,
} from "@/lib/client-event-registration";
import { formatEventDateRu, formatEventPriceRu } from "@/lib/instructor-events";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

export default function ClientRegistrationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["client-registration", id],
    queryFn: async () => {
      const r = await fetch(`/api/client/registrations/${id}`, { credentials: "include" });
      if (!r.ok) throw new Error("registration");
      return r.json() as Promise<{ registration: ClientRegistrationDetail }>;
    },
    enabled: Boolean(id),
  });

  const autoPayStarted = useRef(false);

  const pay = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/client/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "pay" }),
      });
      const j = (await r.json()) as { checkoutUrl?: string; error?: string };
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Не удалось перейти к оплате");
      return j;
    },
    onSuccess: async (j) => {
      if (!j.checkoutUrl) return;
      if (j.checkoutUrl.includes("/client/registrations/")) {
        const path = j.checkoutUrl.replace(/^https?:\/\/[^/]+/, "");
        router.push(path || j.checkoutUrl);
        await refetch();
        return;
      }
      window.location.href = j.checkoutUrl;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reg = data?.registration;

  useEffect(() => {
    const paid = searchParams.get("paid");
    if (paid === "1") toast.success("Оплата прошла — вы записаны на мероприятие");
    if (paid === "0") toast.message("Оплата не завершена");
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("pay") !== "1" || autoPayStarted.current) return;
    if (!reg || reg.status !== "PENDING_PAYMENT") return;
    autoPayStarted.current = true;
    pay.mutate();
  }, [searchParams, reg, pay]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/client">← К поиску инструктора</Link>
        </Button>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/client/orders">Мои заказы</Link>
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : error || !reg ? (
        <p className="text-sm text-destructive">Заявка не найдена</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Запись на мероприятие</CardTitle>
            <p className="text-sm text-muted-foreground">
              {clientRegistrationStatusLabel(reg.status)}
              {reg.amountRub > 0 ? ` · ${reg.amountRub.toLocaleString("ru-RU")} ₽` : " · Бесплатно"}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h2 className="font-semibold">{reg.event.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {reg.instructor.name ?? "Инструктор"}
                {reg.event.eventAt ? ` · ${formatEventDateRu(reg.event.eventAt)}` : ""}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Участие: {formatEventPriceRu(reg.event.priceRub)}
              </p>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {reg.event.body}
            </p>
            <p className="text-xs text-muted-foreground">
              Заявка от {new Date(reg.createdAt).toLocaleString("ru-RU")}
              {reg.paidAt ? ` · оплачено ${new Date(reg.paidAt).toLocaleString("ru-RU")}` : ""}
            </p>

            {reg.status === "PENDING_PAYMENT" ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                Заявка создана. Оплатите участие — после оплаты запись будет подтверждена.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {reg.status === "PENDING_PAYMENT" ? (
                <Button
                  type="button"
                  variant="accent"
                  disabled={pay.isPending}
                  onClick={() => pay.mutate()}
                >
                  {pay.isPending ? "Переход к оплате…" : `Оплатить ${reg.amountRub.toLocaleString("ru-RU")} ₽`}
                </Button>
              ) : null}
              {reg.canCancel ? (
                <CancelRegistrationButton
                  registrationId={reg.id}
                  onCancelled={async () => {
                    await qc.invalidateQueries({ queryKey: ["client-registrations"] });
                    await qc.invalidateQueries({ queryKey: ["orders"] });
                    await qc.invalidateQueries({ queryKey: ["client-events"] });
                    await refetch();
                    router.push("/client/orders");
                  }}
                />
              ) : reg.cancelReason ? (
                <p className="text-sm text-muted-foreground">{reg.cancelReason}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
