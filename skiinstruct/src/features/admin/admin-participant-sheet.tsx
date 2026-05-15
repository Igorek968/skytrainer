"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  type AdminOverview,
  adminActivityCategoryLabel,
  adminMoney,
  adminOrderFlowLabel,
} from "@/features/admin/admin-overview-types";
import { adminOverviewHref } from "@/features/admin/admin-search-params";
import { Button } from "@/shared/ui/button";

function roleRu(role: string): string {
  switch (role) {
    case "ADMIN":
      return "Администратор";
    case "INSTRUCTOR":
      return "Инструктор";
    case "CLIENT":
      return "Клиент";
    default:
      return role;
  }
}

type Props = {
  data: AdminOverview;
  participantId: string | null;
  preserveSearch: { user: string | null; activity: string | null };
};

export function AdminParticipantSheet({ data, participantId, preserveSearch }: Props) {
  const pathname = usePathname();
  const fp = data.focusParticipant;
  const dismissHref = adminOverviewHref(pathname, {
    user: preserveSearch.user,
    activity: preserveSearch.activity,
    participant: null,
  });

  if (!participantId) return null;

  if (!fp || fp.user.id !== participantId) {
    return (
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        role="status"
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Участник по выбору не найден в базе (устаревшая ссылка или удалённый аккаунт).
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href={dismissHref}>Снять выделение</Link>
          </Button>
        </div>
      </div>
    );
  }

  const u = fp.user;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 max-h-[min(42vh,520px)] overflow-hidden border-t border-border bg-background/95 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur supports-[padding:max(0px)]:pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      aria-label="Выбранный участник"
    >
      <div className="mx-auto flex max-h-[inherit] max-w-6xl flex-col px-4 pt-3">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-border/70 pb-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Выбранный участник · контент по текущему разделу
            </p>
            <p className="truncate text-sm font-semibold text-foreground">{u.name?.trim() || "ФИО не указано"}</p>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
            <p className="text-[11px] text-muted-foreground">{roleRu(u.role)}</p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <Link href={dismissHref}>Снять выделение</Link>
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-3">
          <ParticipantSectionBody pathname={pathname} data={data} fp={fp} />
        </div>
      </div>
    </div>
  );
}

function ParticipantSectionBody({
  pathname,
  data,
  fp,
}: {
  pathname: string;
  data: AdminOverview;
  fp: NonNullable<AdminOverview["focusParticipant"]>;
}) {
  if (pathname.startsWith("/admin/activity")) {
    if (fp.activityPreview.length === 0) {
      return <p className="text-sm text-muted-foreground">Нет событий по заказам и чатам этого пользователя.</p>;
    }
    return (
      <ul className="space-y-2 text-sm">
        {fp.activityPreview.map((row) => (
          <li key={row.id} className="rounded-md border border-border/80 bg-muted/20 px-3 py-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{adminActivityCategoryLabel(row.category)}</span>
              <span>{row.eventLabel}</span>
              <time dateTime={row.at}>
                {new Date(row.at).toLocaleString("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
            <p className="mt-1 text-foreground">{row.summary}</p>
            {row.meta ? <p className="mt-0.5 text-xs text-muted-foreground">{row.meta}</p> : null}
          </li>
        ))}
      </ul>
    );
  }

  if (pathname.startsWith("/admin/metrics")) {
    const statusLine = Object.entries(fp.ordersByStatus)
      .filter(([, n]) => n > 0)
      .map(([s, n]) => `${s}: ${n}`)
      .join(" · ");
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricChip label="Заказов всего" value={String(fp.ordersTotal)} />
          <MetricChip label="Ожидают оплаты" value={String(fp.pipeline.awaitingPayment)} />
          <MetricChip label="Ожидают инструктора" value={String(fp.pipeline.pendingInstructor)} />
          <MetricChip label="В работе (урок)" value={String(fp.pipeline.inProgress)} />
          <MetricChip label="Завершено за 30 дн." value={String(fp.pipeline.completedLast30d)} />
        </div>
        <p className="rounded-md border border-border/80 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">По статусам заказов участника: </span>
          {statusLine || "—"}
        </p>
      </div>
    );
  }

  if (pathname.startsWith("/admin/pipeline")) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricChip label="Ожидают оплаты" value={String(fp.pipeline.awaitingPayment)} />
        <MetricChip label="Ожидают инструктора" value={String(fp.pipeline.pendingInstructor)} />
        <MetricChip label="В работе" value={String(fp.pipeline.inProgress)} />
        <MetricChip label="Завершено за 30 дн." value={String(fp.pipeline.completedLast30d)} />
        <div className="sm:col-span-2 lg:col-span-4">
          <p className="text-xs text-muted-foreground">
            Глобальная онлайн-очередь и «запись на дату» остаются в основном блоке раздела; здесь — только этапы по
            заказам выбранного участника.
          </p>
        </div>
      </div>
    );
  }

  if (pathname.startsWith("/admin/finance")) {
    return (
      <div className="space-y-3 text-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricChip label="Оплаченных заказов (участник в заказе)" value={String(fp.finance.paidOrdersCount)} />
          <MetricChip
            label="Оплачено как клиент"
            value={adminMoney(fp.finance.grossPaidAsClientRub)}
            hint="Сумма amountTotal"
          />
          <MetricChip
            label="Доля инструктора (выплаченные)"
            value={adminMoney(fp.finance.instructorSharePaidRub)}
            hint="По заказам, где пользователь — инструктор"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Суммы считаются только по заказам со статусом оплаты PAID; доля платформы на общей вкладке «Финансы».
        </p>
      </div>
    );
  }

  if (pathname.startsWith("/admin/orders")) {
    if (fp.ordersPreview.length === 0) {
      return <p className="text-sm text-muted-foreground">У пользователя нет заказов как клиента или инструктора.</p>;
    }
    return (
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-2 py-2 font-medium">Заказ</th>
              <th className="px-2 py-2 font-medium">Статус</th>
              <th className="px-2 py-2 font-medium">Поток</th>
              <th className="px-2 py-2 font-medium">Сумма</th>
              <th className="px-2 py-2 font-medium">Клиент</th>
              <th className="px-2 py-2 font-medium">Инструктор</th>
            </tr>
          </thead>
          <tbody>
            {fp.ordersPreview.map((o) => (
              <tr key={o.id} className="border-b border-border/60 last:border-b-0">
                <td className="px-2 py-1.5 font-mono text-[11px]">{o.id.slice(0, 12)}…</td>
                <td className="px-2 py-1.5">{o.status}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{adminOrderFlowLabel(o)}</td>
                <td className="px-2 py-1.5">{o.amountTotal != null ? adminMoney(o.amountTotal) : "—"}</td>
                <td className="max-w-[140px] truncate px-2 py-1.5">{o.clientName?.trim() || o.clientEmail}</td>
                <td className="max-w-[140px] truncate px-2 py-1.5">{o.instructorName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (pathname.startsWith("/admin/moderation")) {
    const pending = data.pendingList.some((p) => p.userId === fp.user.id);
    return (
      <div className="space-y-2 text-sm">
        <p>
          Модерация профиля инструктора:{" "}
          <span className="font-medium text-foreground">{pending ? "заявка в очереди" : "нет активной заявки"}</span>
        </p>
        {!pending ? (
          <p className="text-xs text-muted-foreground">
            Заказы и финансы этого пользователя смотрите во вкладках «Заказы» и «Финансы» с включённым выделением.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Выберите раздел слева (лента, показатели, финансы, заказы) — здесь будет узкая сводка по выбранному участнику.
    </p>
  );
}

function MetricChip({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</div>
      {hint ? <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
