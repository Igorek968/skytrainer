import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { publicEventPath } from "@/lib/public-event-path";
import { pageMetadata } from "@/lib/seo";
import { formatEventDateRu } from "@/lib/instructor-events";
import { activePublishedEventWhere } from "@/lib/services/instructor-event-expiry";
import { TrafficLanding } from "@/shared/marketing/traffic-landing";

export const metadata: Metadata = pageMetadata({
  title: "События — дата, место, запись | ТвойТренер.рф",
  description:
    "Актуальные события инструкторов: дата, место и запись онлайн. ТвойТренер.рф — продолжение объявления с понятной оплатой через ЮKassa.",
  path: "/events",
});

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function EventsTrafficLandingPage({ searchParams }: Props) {
  const params = await searchParams;
  const rawId = params.id;
  const id = (Array.isArray(rawId) ? rawId[0] : rawId)?.trim();
  if (id) redirect(publicEventPath(id));

  const now = new Date();
  const events = await prisma.instructorEvent.findMany({
    where: { ...activePublishedEventWhere(now), orderId: null },
    orderBy: [{ eventAt: "asc" }, { createdAt: "desc" }],
    take: 8,
    select: {
      id: true,
      title: true,
      body: true,
      eventAt: true,
      venueAddress: true,
      instructor: { select: { name: true } },
      catalogItem: { select: { title: true, venueAddress: true, eventAt: true } },
    },
  });

  return (
    <TrafficLanding
      eyebrow="ТвойТренер.рф · события"
      title="События с датой и местом — запишитесь онлайн"
      lead="Смотрите ближайшие события инструкторов: когда, где и кто ведёт. Запись и оплата на сайте — без потери контекста после объявления."
      ctaLabel="Открыть карту и инструкторов"
      ctaHref="/?utm_source=landing&utm_campaign=events"
      secondaryCtaLabel="Стать инструктором и публиковать события"
      secondaryCtaHref="/instructor/apply"
      bullets={[
        "В карточке события — дата, адрес и организатор.",
        "Оплата через ЮKassa, оферта и возврат доступны до бронирования.",
        "Для рекламы одного выхода копируйте ссылку события в кабинете инструктора.",
      ]}
    >
      <section className="space-y-3" aria-labelledby="events-upcoming">
        <h2 id="events-upcoming" className="text-xl font-semibold">
          Ближайшие события
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Сейчас нет опубликованных событий. Загляните на карту или подайте заявку
            инструктора, чтобы публиковать свои.
          </p>
        ) : (
          <ul className="space-y-3">
            {events.map((e) => {
              const title = e.catalogItem?.title?.trim() || e.title;
              const whenRaw = e.catalogItem?.eventAt ?? e.eventAt;
              const when = formatEventDateRu(whenRaw ? whenRaw.toISOString() : null);
              const place = e.catalogItem?.venueAddress?.trim() || e.venueAddress?.trim();
              return (
                <li key={e.id} className="rounded-lg border border-border/70 p-3">
                  <Link
                    href={publicEventPath(e.id)}
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {when ? <time>{when}</time> : "Дата уточняется"}
                    {place ? ` · ${place}` : ""}
                    {e.instructor.name ? ` · ${e.instructor.name}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-sm">
          <Link href="/" className="text-primary underline-offset-2 hover:underline">
            Все инструкторы на карте
          </Link>
        </p>
      </section>
    </TrafficLanding>
  );
}
