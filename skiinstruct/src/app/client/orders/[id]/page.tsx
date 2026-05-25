"use client";

import { type UseMutationResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { OrderChat } from "@/features/chat/order-chat";
import { CancelOrderButton, ClaimLateRefundButton } from "@/features/orders/cancel-order-button";
import { OrderEventsFeed } from "@/features/orders/order-events-feed";
import { INSTRUCTOR_LATE_GRACE_MINUTES } from "@/lib/legal-config";
import { devPollInterval } from "@/lib/query-poll";
import { NearbyMapLazy } from "@/features/map/map-loader";
import { orderRelaxedInstructorTiming } from "@/shared/lib/order-flex";
import { hasLessonTimeWindowInNotes, lessonTimeWindowLineFromNotes } from "@/shared/lib/order-lesson-times";
import { useCountdownToDeadline } from "@/shared/hooks/use-countdown-to-deadline";
import {
  extractInstructorEtaMinutes,
  formatArrivalCountdownRu,
  formatCountdownMmSs,
  resolveInstructorArrivalDeadlineMs,
} from "@/shared/lib/order-instructor-eta";
import { clientCanRemoveOrderFromHistory, orderStatusLabel } from "@/shared/lib/order-status";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import type { Order, OrderStatus } from "@prisma/client";

type RoutingMember = { userId: string; name: string | null };

type OrderDTO = Order & {
  client: { id: string; name: string | null; image: string | null };
  instructor: {
    id: string;
    name: string | null;
    image: string | null;
    instructorProfile: {
      lat: number | null;
      lng: number | null;
      hourlyRate: unknown;
      specializations?: string[];
    } | null;
  } | null;
  resort: { name: string } | null;
};

type OrderPayload = { order: OrderDTO; routingQueue?: RoutingMember[] };

type DetailMutations = {
  patch: UseMutationResult<unknown, Error, Record<string, unknown>>;
  removeFromHistory: UseMutationResult<void, Error, void>;
  payStripe: UseMutationResult<void, Error, void>;
};

/** Контент с хуками, зависящими от загруженного заказа — монтируется только когда `data` есть. */
function parsePendingExpiresMs(raw: OrderDTO["pendingExpiresAt"]): number | null {
  if (raw == null) return null;
  const t = new Date(raw as string | Date).getTime();
  return Number.isFinite(t) ? t : null;
}

function extractDiscipline(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const line = notes
    .split("\n")
    .map((s) => s.trim())
    .find((s) => s.toLowerCase().startsWith("дисциплина:"));
  if (!line) return null;
  const value = line.slice("дисциплина:".length).trim();
  return value || null;
}

function formatDateTimeRu(raw: string | Date | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("ru-RU");
}

function ClientOrderDetailContent({
  id,
  data,
  mutations,
}: {
  id: string;
  data: OrderPayload;
  mutations: DetailMutations;
}) {
  const { patch, removeFromHistory, payStripe } = mutations;
  const queryClient = useQueryClient();
  const o = data.order;
  const routingQueue = data.routingQueue;
  const statusEarly = o?.status as OrderStatus | undefined;

  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const pendingExpiresMs = parsePendingExpiresMs(o?.pendingExpiresAt);
  const pendingCountdownEnabled = statusEarly === "PENDING_INSTRUCTOR" && pendingExpiresMs != null;
  const secondsLeft = useCountdownToDeadline(pendingExpiresMs, pendingCountdownEnabled);

  const arrivalDeadlineMs = useMemo(
    () =>
      resolveInstructorArrivalDeadlineMs({
        instructorEtaAt: o?.instructorEtaAt,
        acceptedAt: o?.acceptedAt,
        notes: o?.notes,
      }),
    [o?.instructorEtaAt, o?.acceptedAt, o?.notes],
  );
  const arrivalCountdownEnabled =
    arrivalDeadlineMs != null &&
    (statusEarly === "ACCEPTED" ||
      statusEarly === "INSTRUCTOR_EN_ROUTE" ||
      statusEarly === "LESSON_STARTED");
  const arrivalSecondsLeft = useCountdownToDeadline(arrivalDeadlineMs, arrivalCountdownEnabled);

  if (!o) {
    return <p className="text-destructive">Заказ не найден или данные не загрузились.</p>;
  }

  const status = o.status as OrderStatus;
  const relaxedTiming = orderRelaxedInstructorTiming({
    flexibleInstructorInvite: Boolean(o.flexibleInstructorInvite),
    requestedDays: o.requestedDays,
    requestedStartDate: o.requestedStartDate,
  });
  const discipline =
    extractDiscipline(o.notes) ??
    o.instructor?.instructorProfile?.specializations?.[0] ??
    "Не указано";
  const instructorEtaMinutes = extractInstructorEtaMinutes(o.notes);

  const lateRefundEligible =
    o.paymentStatus === "PAID" &&
    !o.lateRefundClaimedAt &&
    !o.lessonStartedAt &&
    (status === "ACCEPTED" || status === "INSTRUCTOR_EN_ROUTE") &&
    arrivalDeadlineMs != null &&
    Date.now() >= arrivalDeadlineMs + INSTRUCTOR_LATE_GRACE_MINUTES * 60_000;

  const refreshOrder = () => void queryClient.invalidateQueries({ queryKey: ["order", id] });

  const instrPos =
    o.instructor?.instructorProfile?.lat != null &&
    o.instructor?.instructorProfile?.lng != null
      ? ([o.instructor.instructorProfile.lat, o.instructor.instructorProfile.lng] as [
          number,
          number,
        ])
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">
            <Link className="underline" href="/client/orders">
              ← Назад
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{orderStatusLabel(status)}</h1>
          <p className="text-sm text-muted-foreground">
            Создан: {new Date(o.createdAt).toLocaleString("ru-RU")}
          </p>
          {status === "EXPIRED" ? (
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {relaxedTiming ? (
                <>
                  Заявка не была принята выбранным инструктором или в сети не оказалось подходящих
                  инструкторов. Создайте новый заказ позже или измените параметры (точка встречи, язык, даты).
                </>
              ) : (
                <>
                  Заявка прошла очередь онлайн-инструкторов: за отведённые 60 секунд никто не принял её на своём
                  этапе, либо подходящих инструкторов в сети не оказалось. Создайте новый заказ позже или измените
                  параметры (точка встречи, язык, даты).
                </>
              )}
            </p>
          ) : null}
        </div>
      </div>

      {(status === "ACCEPTED" ||
        status === "INSTRUCTOR_EN_ROUTE" ||
        status === "LESSON_STARTED") &&
      instrPos ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Инструктор на карте</CardTitle>
          </CardHeader>
          <CardContent>
            <NearbyMapLazy
              interactive={false}
              center={[o.meetLat, o.meetLng]}
              meetLat={o.meetLat}
              meetLng={o.meetLng}
              radiusKm={5}
              instructors={[
                {
                  id: o.instructor!.id,
                  name: o.instructor!.name,
                  lat: instrPos[0],
                  lng: instrPos[1],
                  hourlyRate: Number(o.instructor!.instructorProfile?.hourlyRate ?? 0),
                  ratingAvg: 0,
                  distanceKm: 0,
                },
              ]}
              onMeetChange={() => {
                /* readonly */
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      {arrivalDeadlineMs != null &&
      (status === "ACCEPTED" || status === "INSTRUCTOR_EN_ROUTE" || status === "LESSON_STARTED") ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ожидаемое прибытие инструктора</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {arrivalSecondsLeft != null ? (
              <>
                <p className="text-muted-foreground">
                  Инструктор указал ETA ~{instructorEtaMinutes ?? "—"} мин. До встречи осталось:
                </p>
                <div
                  className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-300"
                  aria-live="polite"
                  aria-atomic="true"
                  data-eta-countdown="live"
                >
                  {formatCountdownMmSs(arrivalSecondsLeft)}
                </div>
                <p className="text-xs text-muted-foreground">
                  ({formatArrivalCountdownRu(arrivalSecondsLeft)})
                  {arrivalSecondsLeft === 0
                    ? " · ожидаем инструктора у точки встречи — напишите в чат, если задержка"
                    : null}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Загрузка таймера…</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {status === "PENDING_INSTRUCTOR" && routingQueue && routingQueue.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {o.flexibleInstructorInvite
                ? "Запись на дату"
                : relaxedTiming
                  ? "Бронь на несколько дней"
                  : "Кому сейчас предложена заявка"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {relaxedTiming ? (
              o.flexibleInstructorInvite ? (
                <p className="text-muted-foreground">
                  Заявка отправлена выбранному инструктору. Он получил уведомление и может ответить, когда будет
                  готов — <strong>без ограничения по времени</strong>.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Заявка на несколько дней у выбранного инструктора: ответ <strong>без таймера 60 с</strong>, без
                  срочного ETA до встречи — согласование по датам и времени в чате или при встрече.
                </p>
              )
            ) : (
              <p className="text-muted-foreground">
                Программа по очереди предлагает заявку онлайн-инструкторам под ваши параметры. У каждого есть{" "}
                <strong>60 секунд</strong>, чтобы принять её. Если время истекает или инструктор отклоняет
                заявку, она автоматически переходит к следующему из очереди. Если доступных инструкторов мало,
                очередь идёт <strong>по кругу</strong>, пока кто-то не примет заявку или все не перестанут быть
                доступными.
              </p>
            )}
            {!relaxedTiming && pendingExpiresMs != null ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-medium text-amber-800 dark:text-amber-200">
                Ожидание ответа текущего инструктора:{" "}
                <span className="font-mono tabular-nums">{formatCountdownMmSs(secondsLeft ?? 0)}</span>
              </div>
            ) : null}
            <div>
              <div className="mb-1 font-medium">
                Сейчас выбран системой:{" "}
                <span className="text-foreground">{o.instructor?.name ?? "—"}</span>
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                {routingQueue.map((row, i) => (
                  <li
                    key={row.userId}
                    className={
                      i === o.instructorQueueIndex ? "font-semibold text-foreground" : undefined
                    }
                  >
                    {row.name ?? row.userId}
                    {i === o.instructorQueueIndex ? " — текущий" : ""}
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      ) : status === "PENDING_INSTRUCTOR" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {o.flexibleInstructorInvite
                ? "Ожидание ответа инструктора"
                : relaxedTiming
                  ? "Ожидание ответа (несколько дней)"
                  : "Ожидание инструктора"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {relaxedTiming ? (
              o.flexibleInstructorInvite ? (
                <p className="text-muted-foreground">
                  Заявка у инструктора <strong>{o.instructor?.name ?? "—"}</strong>. Ответ без таймера — он
                  уведомлён и сможет принять заявку позже.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Заявка у инструктора <strong>{o.instructor?.name ?? "—"}</strong> на несколько дней. Ответ без
                  таймера 60 с; срочный ETA до встречи не требуется.
                </p>
              )
            ) : (
              <p className="text-muted-foreground">
                Заявка отправлена инструктору <strong>{o.instructor?.name ?? "—"}</strong>. На ответ даётся до{" "}
                <strong>60 секунд</strong>; при необходимости система передаёт её следующему доступному
                инструктору по очереди (в том числе по кругу).
              </p>
            )}
            {!relaxedTiming && pendingExpiresMs != null ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-medium text-amber-800 dark:text-amber-200">
                Осталось:{" "}
                <span className="font-mono tabular-nums">{formatCountdownMmSs(secondsLeft ?? 0)}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {status === "AWAITING_PAYMENT" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Оплата перед отправкой инструктору</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Средства резервируются на стороне платформы. После успешной оплаты заявка уходит выбранному
              инструктору
              {relaxedTiming ? "" : " и очереди онлайн-инструкторов"}.
              Комиссия сервиса уже учтена в сумме (15% от ставки за занятие); после того как инструктор отметит
              урок выполненным, доля инструктора считается переданной за вычетом этой комиссии.
            </p>
            {o.paymentStatus === "PENDING" && o.amountTotal ? (
              <Button type="button" variant="accent" disabled={payStripe.isPending} onClick={() => payStripe.mutate()}>
                Оплатить и отправить заявку
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Детали</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            Инструктор: <span className="font-medium">{o.instructor?.name ?? "—"}</span>
          </div>
          <div>
            Дисциплина: <span className="font-medium">{discipline}</span>
          </div>
          <div>Сумма: {o.amountTotal ? `${Number(o.amountTotal)} ₽` : "—"}</div>
          <div>Оплата: {o.paymentStatus}</div>
          {o.requestedStartDate ? (
            <div>
              Период занятий:{" "}
              <span className="font-medium">
                {new Date(o.requestedStartDate).toLocaleDateString("ru-RU")}
                {o.requestedEndDate &&
                new Date(o.requestedEndDate).toDateString() !==
                  new Date(o.requestedStartDate).toDateString()
                  ? ` — ${new Date(o.requestedEndDate).toLocaleDateString("ru-RU")}`
                  : null}
                {o.requestedDays != null && o.requestedDays > 1 ? ` (${o.requestedDays} дн.)` : null}
              </span>
            </div>
          ) : null}
          {hasLessonTimeWindowInNotes(o.notes) ? (
            <div>
              <span className="font-medium">{lessonTimeWindowLineFromNotes(o.notes)}</span>
            </div>
          ) : null}
          {instructorEtaMinutes != null ? <div>ETA: ~{instructorEtaMinutes} мин</div> : null}
          {status === "COMPLETED" ? (
            <div className="rounded-md border border-border bg-muted/20 p-2">
              <div>Начало занятия: {formatDateTimeRu(o.lessonStartedAt)}</div>
              <div>Завершение занятия: {formatDateTimeRu(o.lessonEndedAt)}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {o.instructorId &&
      status !== "PENDING_INSTRUCTOR" &&
      status !== "AWAITING_PAYMENT" &&
      status !== "CANCELLED" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Отзыв инструктора о вас</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {o.instructorRating != null ? (
                <>
                  <div>Оценка: {o.instructorRating}/5</div>
                  <p className="mt-1 text-muted-foreground">{o.instructorReview || "Без текста"}</p>
                </>
              ) : (
                <p className="text-muted-foreground">Пока нет отзыва от инструктора.</p>
              )}
            </CardContent>
          </Card>
          <OrderEventsFeed orderId={id} instructorName={o.instructor?.name} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(status === "DRAFT" ||
          status === "AWAITING_PAYMENT" ||
          status === "PENDING_INSTRUCTOR" ||
          status === "ACCEPTED" ||
          status === "INSTRUCTOR_EN_ROUTE") && (
          <CancelOrderButton orderId={id} disabled={patch.isPending} onCancelled={refreshOrder} />
        )}

        {lateRefundEligible ? (
          <ClaimLateRefundButton orderId={id} disabled={patch.isPending} onDone={refreshOrder} />
        ) : null}

        {clientCanRemoveOrderFromHistory(status) ? (
          <Button
            type="button"
            variant="outline"
            disabled={removeFromHistory.isPending || patch.isPending}
            onClick={() => {
              if (
                !confirm(
                  "Удалить заказ из истории? Данные будут удалены без возможности восстановления."
                )
              ) {
                return;
              }
              removeFromHistory.mutate();
            }}
          >
            Удалить из истории
          </Button>
        ) : null}

        {status === "COMPLETED" && o.paymentStatus === "PENDING" ? (
          <>
            <Button type="button" variant="accent" onClick={() => payStripe.mutate()}>
              Оплатить картой (Stripe)
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={patch.isPending}
              onClick={() =>
                patch.mutate(
                  { action: "set_payment_cash" },
                  { onSuccess: () => toast.success("Отмечено: наличные") }
                )
              }
            >
              Оплата наличными
            </Button>
          </>
        ) : null}

        {status === "COMPLETED" && o.paymentStatus === "FAILED" ? (
          <>
            <Button type="button" variant="accent" onClick={() => payStripe.mutate()}>
              Оплатить картой (Stripe)
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={patch.isPending}
              onClick={() =>
                patch.mutate(
                  { action: "set_payment_cash" },
                  { onSuccess: () => toast.success("Отмечено: наличные") }
                )
              }
            >
              Оплата наличными
            </Button>
          </>
        ) : null}

        {status === "COMPLETED" && o.clientRating == null ? (
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-base">Оценка инструктора</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <label className="flex items-center gap-2 text-sm">
                Оценка
                <Input
                  type="number"
                  min={1}
                  max={5}
                  className="w-20"
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                />
              </label>
              <Input
                placeholder="Отзыв"
                value={review}
                onChange={(e) => setReview(e.target.value)}
              />
              <Button
                type="button"
                disabled={patch.isPending}
                onClick={() =>
                  patch.mutate(
                    { action: "add_review", rating, review },
                    { onSuccess: () => toast.success("Спасибо за отзыв") }
                  )
                }
              >
                Отправить отзыв
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {status !== "PENDING_INSTRUCTOR" &&
      status !== "AWAITING_PAYMENT" &&
      status !== "CANCELLED" ? (
        <OrderChat orderId={id} />
      ) : null}
    </div>
  );
}

export default function ClientOrderPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const r = await fetch(`/api/orders/${id}`);
      if (!r.ok) throw new Error("order");
      return r.json() as Promise<OrderPayload>;
    },
    refetchInterval: devPollInterval(5000),
  });

  const removeFromHistory = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(typeof j.error === "string" ? j.error : "delete");
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Заказ удалён из истории");
      router.push("/client/orders");
    },
    onError: (e: Error) => toast.error(e.message || "Не удалось удалить"),
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

  const payStripe = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id }),
      });
      const raw = await r.text();
      const j = (() => {
        try {
          return (raw ? JSON.parse(raw) : {}) as { url?: string; error?: unknown };
        } catch {
          return {} as { url?: string; error?: unknown };
        }
      })();
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "stripe");
      if (!j.url) throw new Error("Не удалось создать ссылку оплаты");
      window.location.href = j.url;
    },
    onError: (e: Error) => toast.error(e.message || "Ошибка оплаты"),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !data || !data.order) {
    return <p className="text-destructive">Заказ не найден</p>;
  }

  return (
    <ClientOrderDetailContent
      key={id}
      id={id}
      data={data}
      mutations={{ patch, removeFromHistory, payStripe }}
    />
  );
}
