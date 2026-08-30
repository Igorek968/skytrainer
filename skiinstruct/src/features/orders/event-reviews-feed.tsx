"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { EventReviewDTO, EventReviewsSummary } from "@/lib/event-reviews";
import { formatEventRatingTitle } from "@/lib/event-reviews";
import { Button } from "@/shared/ui/button";

function ReviewItem({ review }: { review: EventReviewDTO }) {
  const when = new Date(review.createdAt);
  const dateLabel = Number.isFinite(when.getTime())
    ? when.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
    : "";
  return (
    <li className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <p className="text-xs font-medium text-foreground">
        ★ {review.rating} · {review.authorName ?? "Ученик"}
        {dateLabel ? <span className="font-normal text-muted-foreground"> · {dateLabel}</span> : null}
      </p>
      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
        {review.text?.trim() || "Оценка без текста"}
      </p>
    </li>
  );
}

export function EventReviewsFeed({
  eventId,
  catalogId,
  summary,
}: {
  eventId?: string | null;
  catalogId?: string | null;
  summary: EventReviewsSummary;
}) {
  const [expanded, setExpanded] = useState(false);
  const canFetch = Boolean(eventId || catalogId);
  const qs = catalogId ? `catalogId=${encodeURIComponent(catalogId)}` : `eventId=${encodeURIComponent(eventId ?? "")}`;

  const allQuery = useQuery({
    queryKey: ["event-reviews", catalogId ?? "", eventId ?? ""],
    enabled: expanded && canFetch,
    queryFn: async () => {
      const r = await fetch(`/api/public/event-reviews?${qs}`);
      if (!r.ok) throw new Error("Не удалось загрузить отзывы");
      return r.json() as Promise<{ reviews: EventReviewDTO[] }>;
    },
  });

  const preview = summary.reviewsPreview ?? [];
  const feed = expanded ? (allQuery.data?.reviews ?? preview) : preview.slice(0, 3);
  const total = summary.reviewCount ?? 0;

  if (total < 1 && preview.length < 1) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Отзывы</p>
        <p className="text-xs text-muted-foreground">Пока нет отзывов. После события участники смогут оценить выезд.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-foreground">Отзывы</p>
        <p className="text-xs text-muted-foreground">{formatEventRatingTitle(summary.ratingAvg, total)}</p>
      </div>
      {allQuery.isError ? (
        <p className="text-xs text-destructive">Не удалось загрузить отзывы</p>
      ) : null}
      <ul className="max-h-64 space-y-2 overflow-y-auto overscroll-contain" role="feed" aria-label="Отзывы о событии">
        {feed.map((review) => (
          <ReviewItem key={review.id} review={review} />
        ))}
      </ul>
      {expanded && allQuery.isFetching ? (
        <p className="text-xs text-muted-foreground">Загружаем…</p>
      ) : null}
      {total > 3 || preview.length > 3 ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Свернуть" : "Все отзывы"}
        </Button>
      ) : null}
    </div>
  );
}
