"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

type Sort = "date_desc" | "date_asc" | "rating_desc" | "rating_asc";

type ReviewsResponse = {
  reviews: {
    id: string;
    createdAt: string;
    rating: number | null;
    text: string | null;
    authorName: string | null;
  }[];
};

export default function InstructorReviewsPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const sort = (search.get("sort") as Sort) || "date_desc";
  const id = params.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["instructor-reviews", id, sort],
    queryFn: async () => {
      const r = await fetch(`/api/instructors/${id}/reviews?sort=${sort}&limit=200`);
      if (!r.ok) throw new Error("reviews");
      return r.json() as Promise<ReviewsResponse>;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Все отзывы об инструкторе</h1>
        <Link className="text-sm text-accent underline" href={`/instructors/${id}`}>
          ← К профилю инструктора
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <SortLink id={id} current={sort} value="date_desc" label="Сначала новые" />
        <SortLink id={id} current={sort} value="date_asc" label="Сначала старые" />
        <SortLink id={id} current={sort} value="rating_desc" label="Высокая оценка" />
        <SortLink id={id} current={sort} value="rating_asc" label="Низкая оценка" />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">Не удалось загрузить отзывы</p>
      ) : !data?.reviews.length ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Отзывов пока нет.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {data.reviews.map((r) => (
            <li key={r.id}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    ★ {r.rating ?? "—"} · {r.authorName ?? "Ученик"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p>{r.text || "Отзыв без текста"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString("ru-RU")}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SortLink({
  id,
  current,
  value,
  label,
}: {
  id: string;
  current: Sort;
  value: Sort;
  label: string;
}) {
  const active = current === value;
  return (
    <Link
      href={`/instructors/${id}/reviews?sort=${value}`}
      className={`rounded-md border px-3 py-1 ${active ? "border-accent text-accent" : "border-border"}`}
    >
      {label}
    </Link>
  );
}
