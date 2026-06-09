"use client";

import { type UseMutationResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { OrderChat } from "@/features/chat/order-chat";
import { NpdReceiptUpload } from "@/features/instructor/npd-receipt-upload";
import { CancelOrderButton } from "@/features/orders/cancel-order-button";
import { OrderEventsFeed } from "@/features/orders/order-events-feed";
import { devPollInterval } from "@/lib/query-poll";
import { NearbyMapLazy } from "@/features/map/map-loader";
import {
  formatUrgentCountdown,
  orderIsUrgent,
  orderRelaxedInstructorTiming,
  orderSkipsInstructorEta,
  urgentDeadlineLabel,
} from "@/shared/lib/order-flex";
import { OrderLessonTimeBlock } from "@/shared/ui/order-lesson-time-block";
import { orderHasMeetAddress, resolveMeetAddress } from "@/shared/lib/order-meet-address";
import { lessonDurationLabelRu, resolveOrderDisplayDuration } from "@/shared/lib/order-duration";
import { orderStatusLabel } from "@/shared/lib/order-status";
import { OrderCancellationSide } from "@/shared/ui/order-cancellation-side";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import type { Order, OrderStatus } from "@prisma/client";

type OrderDTO = Order & {
  client: { id: string; name: string | null };
  meetLat: number;
  meetLng: number;
};

function InstructorOrderDetailContent({
  id,
  data,
  patch,
  onRefresh,
}: {
  id: string;
  data: { order: OrderDTO };
  patch: UseMutationResult<unknown, Error, Record<string, unknown>>;
  onRefresh: () => void;
}) {
  const etaOptions = Array.from({ length: 48 }, (_, i) => (i + 1) * 5);
  const extractEtaFromNotes = (notes: string | null | undefined): number => {
    const match = (notes ?? "").match(/ETA инструктора:\s*~?(\d{1,3})\s*мин/i);
    const val = match ? Number(match[1]) : 20;
    if (!Number.isFinite(val) || val < 1) return 20;
    return Math.min(240, Math.max(1, Math.round(val)));
  };
  const safeOrder = data.order;
  const safeStatus = safeOrder.status as OrderStatus;
  const timingInput = {
    urgentInvite: Boolean(safeOrder.urgentInvite),
    flexibleInstructorInvite: Boolean(safeOrder.flexibleInstructorInvite),
    requestedDays: safeOrder.requestedDays,
    requestedStartDate: safeOrder.requestedStartDate,
  };
  const relaxedTiming = orderRelaxedInstructorTiming(timingInput);
  const isUrgent = orderIsUrgent(timingInput);
  const skipsEta = orderSkipsInstructorEta(timingInput);

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [clientRating, setClientRating] = useState(5);
  const [clientReview, setClientReview] = useState("");
  const [etaMinutes, setEtaMinutes] = useState<number>(extractEtaFromNotes(safeOrder.notes));
  const [instructorPos, setInstructorPos] = useState<[number, number] | null>(null);

  const pendingExpiresAtRaw = safeOrder.pendingExpiresAt;
  const pendingExpiresMs =
    pendingExpiresAtRaw != null ? new Date(pendingExpiresAtRaw).getTime() : null;

  const meetPlace = resolveMeetAddress(safeOrder);
  const canAccept = orderHasMeetAddress(safeOrder);
  const displayDuration = resolveOrderDisplayDuration({
    duration: safeOrder.duration,
    requestedStartDate: safeOrder.requestedStartDate,
    requestedEndDate: safeOrder.requestedEndDate,
    notes: safeOrder.notes,
    amountTotal: safeOrder.amountTotal != null ? Number(safeOrder.amountTotal) : null,
    agreedHourlyRate:
      safeOrder.agreedHourlyRate != null ? Number(safeOrder.agreedHourlyRate) : null,
  });

  useEffect(() => {
    if (safeStatus !== "PENDING_INSTRUCTOR" || !isUrgent || pendingExpiresMs == null) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((pendingExpiresMs - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const timerId = window.setInterval(tick, 1000);
    return () => window.clearInterval(timerId);
  }, [safeStatus, pendingExpiresMs, isUrgent]);

  useEffect(() => {
    setEtaMinutes(extractEtaFromNotes(safeOrder.notes));
  }, [safeOrder.notes]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setInstructorPos([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        /* geolocation denied/unavailable */
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const mapsHref = instructorPos
    ? `https://www.openstreetmap.org/directions?engine=graphhopper_foot&route=${instructorPos[0]}%2C${instructorPos[1]}%3B${safeOrder.meetLat}%2C${safeOrder.meetLng}`
    : `https://www.openstreetmap.org/directions?engine=graphhopper_foot&route=${safeOrder.meetLat}%2C${safeOrder.meetLng}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">
            <Link className="underline" href="/instructor/orders">
              ← Назад
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{orderStatusLabel(safeStatus)}</h1>
        </div>
        <Button asChild variant="outline">
          <a href={mapsHref} target="_blank" rel="noreferrer">
            Маршрут (OSM)
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Точка встречи</CardTitle>
        </CardHeader>
        <CardContent>
          <NearbyMapLazy
            interactive={false}
            center={[safeOrder.meetLat, safeOrder.meetLng]}
            meetLat={safeOrder.meetLat}
            meetLng={safeOrder.meetLng}
            radiusKm={5}
            instructors={
              instructorPos
                ? [
                    {
                      id: "current-instructor",
                      name: "Вы",
                      lat: instructorPos[0],
                      lng: instructorPos[1],
                      hourlyRate: 0,
                      ratingAvg: 0,
                      distanceKm: 0,
                    },
                  ]
                : []
            }
            onMeetChange={() => {
              /* no-op */
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 py-4 text-sm">
          <div>Клиент: {safeOrder.client.name}</div>
          <div>
            Место встречи:{" "}
            <span className="font-medium">{meetPlace ?? "—"}</span>
            {!canAccept && safeStatus === "PENDING_INSTRUCTOR" ? (
              <span className="ml-1 text-destructive">(нельзя принять без адреса)</span>
            ) : null}
          </div>
          {safeOrder.requestedStartDate ? (
            <div>
              Период:{" "}
              {new Date(safeOrder.requestedStartDate).toLocaleDateString("ru-RU")}
              {safeOrder.requestedEndDate &&
              new Date(safeOrder.requestedEndDate).toDateString() !==
                new Date(safeOrder.requestedStartDate).toDateString()
                ? ` — ${new Date(safeOrder.requestedEndDate).toLocaleDateString("ru-RU")}`
                : null}
              {safeOrder.requestedDays != null && safeOrder.requestedDays > 1
                ? ` (${safeOrder.requestedDays} дн.)`
                : null}
            </div>
          ) : null}
          <OrderLessonTimeBlock order={safeOrder} />
          <div>Длительность занятия: {lessonDurationLabelRu(displayDuration)}</div>
          <div>Сумма: {safeOrder.amountTotal ? `${Number(safeOrder.amountTotal)} ₽` : "—"}</div>
          <OrderCancellationSide status={safeStatus} cancelledBy={safeOrder.cancelledBy} />
          {safeStatus === "PENDING_INSTRUCTOR" && isUrgent ? (
            <div className="font-medium text-amber-600">
              {pendingExpiresMs == null
                ? "Срочная заявка ожидает вашего решения."
                : `Срочно — осталось ${formatUrgentCountdown(secondsLeft ?? 0)} из ${urgentDeadlineLabel()}`}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {(safeStatus === "ACCEPTED" ||
        safeStatus === "INSTRUCTOR_EN_ROUTE" ||
        safeStatus === "LESSON_STARTED") &&
      !skipsEta ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Время прибытия на место встречи</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Выберите минуты в списке и подтвердите — клиент увидит ETA в информации о заказе.
            </div>
            <div className="grid gap-3 md:grid-cols-[200px_1fr]">
              <select
                aria-label="Минуты ETA"
                size={6}
                className="h-40 rounded-md border border-input bg-background px-2 py-1 text-sm"
                value={etaMinutes}
                onChange={(e) => setEtaMinutes(Number(e.target.value))}
              >
                {etaOptions.map((m) => (
                  <option key={m} value={m}>
                    ~{m} мин
                  </option>
                ))}
              </select>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={patch.isPending}
                  onClick={() =>
                    patch.mutate(
                      { action: "set_eta", etaMinutes },
                      { onSuccess: () => toast.success(`ETA обновлён: ~${etaMinutes} мин`) },
                    )
                  }
                >
                  Сообщить время прибытия
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {safeStatus === "PENDING_INSTRUCTOR" && !skipsEta ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Прибытие на место встречи</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Укажите, через сколько минут вы сможете быть у точки встречи — клиент увидит обратный отсчёт.
            </p>
            <div className="grid gap-3 md:grid-cols-[200px_1fr]">
              <select
                aria-label="Минуты до места встречи"
                size={6}
                className="h-40 rounded-md border border-input bg-background px-2 py-1 text-sm"
                value={etaMinutes}
                onChange={(e) => setEtaMinutes(Number(e.target.value))}
              >
                {etaOptions.map((m) => (
                  <option key={m} value={m}>
                    ~{m} мин
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {safeStatus === "PENDING_INSTRUCTOR" ? (
          <>
            <Button
              type="button"
              variant="accent"
              disabled={patch.isPending || !canAccept}
              onClick={() =>
                patch.mutate(
                  skipsEta ? { action: "accept" } : { action: "accept", etaMinutes },
                  { onSuccess: () => toast.success("Принято") }
                )
              }
            >
              {isUrgent ? `Принять (срочно, ${urgentDeadlineLabel()})` : "Принять"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={patch.isPending}
              onClick={() => patch.mutate({ action: "reject" })}
            >
              Отклонить
            </Button>
          </>
        ) : null}

        {safeStatus === "ACCEPTED" ? (
          <Button type="button" disabled={patch.isPending} onClick={() => patch.mutate({ action: "en_route" })}>
            В пути
          </Button>
        ) : null}

        {safeStatus === "INSTRUCTOR_EN_ROUTE" ? (
          <Button type="button" disabled={patch.isPending} onClick={() => patch.mutate({ action: "start_lesson" })}>
            Урок начался
          </Button>
        ) : null}

        {safeStatus === "LESSON_STARTED" ? (
          <Button
            type="button"
            variant="accent"
            disabled={patch.isPending}
            onClick={() =>
              patch.mutate(
                { action: "complete_lesson" },
                { onSuccess: () => toast.success("Урок завершён") }
              )
            }
          >
            Завершить урок
          </Button>
        ) : null}

        {(safeStatus === "AWAITING_PAYMENT" ||
          safeStatus === "ACCEPTED" ||
          safeStatus === "INSTRUCTOR_EN_ROUTE" ||
          safeStatus === "LESSON_STARTED") && (
          <CancelOrderButton orderId={id} disabled={patch.isPending} onCancelled={onRefresh} />
        )}
      </div>

      {safeStatus === "COMPLETED" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Чек НПД / ККТ</CardTitle>
          </CardHeader>
          <CardContent>
            <NpdReceiptUpload
              orderId={id}
              existingUrl={(safeOrder as Order & { npdReceiptUrl?: string | null }).npdReceiptUrl}
              onUploaded={onRefresh}
            />
          </CardContent>
        </Card>
      ) : null}

      {safeStatus === "COMPLETED" && safeOrder.instructorRating == null ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Оценка клиента</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 text-sm">
              Оценка
              <Input
                type="number"
                min={1}
                max={5}
                className="w-20"
                value={clientRating}
                onChange={(e) => setClientRating(Number(e.target.value))}
              />
            </label>
            <Input
              placeholder="Отзыв о клиенте"
              value={clientReview}
              onChange={(e) => setClientReview(e.target.value)}
            />
            <Button
              type="button"
              disabled={patch.isPending}
              onClick={() =>
                patch.mutate(
                  { action: "add_client_review", rating: clientRating, review: clientReview },
                  { onSuccess: () => toast.success("Отзыв о клиенте отправлен") }
                )
              }
            >
              Сохранить отзыв
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {safeStatus === "COMPLETED" && safeOrder.instructorRating != null ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ваш отзыв о клиенте</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>Оценка: {safeOrder.instructorRating}/5</div>
            <div className="text-muted-foreground">{safeOrder.instructorReview || "Без текста"}</div>
          </CardContent>
        </Card>
      ) : null}

      {safeStatus !== "PENDING_INSTRUCTOR" && safeStatus !== "CANCELLED" ? (
        <>
          <OrderEventsFeed orderId={id} />
          <OrderChat orderId={id} />
        </>
      ) : null}
    </div>
  );
}

export default function InstructorOrderPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const r = await fetch(`/api/orders/${id}`);
      if (!r.ok) throw new Error("order");
      return r.json() as Promise<{ order: OrderDTO }>;
    },
    refetchInterval: devPollInterval(4000),
  });

  const patch = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(typeof j.error === "string" ? j.error : "patch");
      }
      return r.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["order", id] });
      await qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-destructive">Заказ не найден</p>;
  }

  return (
    <InstructorOrderDetailContent
      key={id}
      id={id}
      data={data}
      patch={patch}
      onRefresh={() => void qc.invalidateQueries({ queryKey: ["order", id] })}
    />
  );
}
