export type EventReviewDTO = {
  id: string;
  rating: number;
  text: string | null;
  authorName: string | null;
  createdAt: string;
};

export type EventReviewsSummary = {
  ratingAvg: number | null;
  reviewCount: number;
  reviewsPreview: EventReviewDTO[];
};

export const EVENT_REVIEWS_PREVIEW_COUNT = 3;

export function emptyEventReviewsSummary(): EventReviewsSummary {
  return { ratingAvg: null, reviewCount: 0, reviewsPreview: [] };
}

export function formatEventRatingBadge(avg: number | null, count: number): string {
  if (count < 1 || avg == null || !Number.isFinite(avg)) return "★ —";
  return `★ ${avg.toFixed(1).replace(".", ",")}`;
}

export function formatEventRatingTitle(avg: number | null, count: number): string {
  if (count < 1 || avg == null) return "Пока нет отзывов";
  const n = Math.round(count);
  const word =
    n % 10 === 1 && n % 100 !== 11
      ? "отзыв"
      : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
        ? "отзыва"
        : "отзывов";
  return `Рейтинг ${avg.toFixed(1).replace(".", ",")} · ${n} ${word}`;
}

export function reviewAuthorLabel(name: string | null | undefined): string {
  const n = name?.trim();
  if (!n) return "Ученик";
  return n.split(/\s+/)[0]!;
}

export function summarizeEventReviews(
  rows: Array<{
    id: string;
    rating: number;
    text: string | null;
    authorName: string | null;
    createdAt: Date | string;
  }>,
): EventReviewsSummary {
  if (!rows.length) return emptyEventReviewsSummary();
  const ratings = rows.map((r) => r.rating).filter((n) => n >= 1 && n <= 5);
  const avg =
    ratings.length > 0 ? Math.round((ratings.reduce((s, n) => s + n, 0) / ratings.length) * 10) / 10 : null;
  const sorted = [...rows].sort((a, b) => {
    const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
    const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
    return tb - ta;
  });
  return {
    ratingAvg: avg,
    reviewCount: ratings.length,
    reviewsPreview: sorted.slice(0, EVENT_REVIEWS_PREVIEW_COUNT).map((r) => ({
      id: r.id,
      rating: r.rating,
      text: r.text,
      authorName: r.authorName,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    })),
  };
}
