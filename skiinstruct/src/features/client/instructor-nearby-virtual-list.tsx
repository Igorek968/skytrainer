"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, Star } from "lucide-react";
import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import type {
  ClientInstructorListItem,
  ClientInstructorProfileResponse,
} from "@/features/client/instructor-profile-types";
import { instructorListAvatar } from "@/features/client/instructor-profile-utils";
import { InstructorSearchExpandedBody } from "@/features/client/instructor-search-expanded-body";
import { Button } from "@/shared/ui/button";
import { InstructorPhoto } from "@/shared/ui/instructor-photo";
import type { PhotoViewerState } from "@/shared/ui/photo-viewer-overlay";
import { Skeleton } from "@/shared/ui/skeleton";

const COLLAPSED_ROW_ESTIMATE = 132;
const EXPANDED_ROW_ESTIMATE = 720;

type InstructorNearbyVirtualListProps = {
  items: ClientInstructorListItem[];
  selectedId: string | null;
  expandedId: string | null;
  expandedProfile: ClientInstructorProfileResponse | undefined;
  isExpandedProfileLoading: boolean;
  isExpandedProfileError: boolean;
  showAllReviewsFor: string | null;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setExpandedId: Dispatch<SetStateAction<string | null>>;
  setShowAllReviewsFor: Dispatch<SetStateAction<string | null>>;
  setPhotoPreview: Dispatch<SetStateAction<PhotoViewerState | null>>;
  onStartCheckout: (instructorId: string) => void;
};

export function InstructorNearbyVirtualList({
  items,
  selectedId,
  expandedId,
  expandedProfile,
  isExpandedProfileLoading,
  isExpandedProfileError,
  showAllReviewsFor,
  setSelectedId,
  setExpandedId,
  setShowAllReviewsFor,
  setPhotoPreview,
  onStartCheckout,
}: InstructorNearbyVirtualListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) =>
      items[index]?.id === expandedId ? EXPANDED_ROW_ESTIMATE : COLLAPSED_ROW_ESTIMATE,
    overscan: 4,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  useEffect(() => {
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remeasure on expand/collapse
  }, [expandedId, expandedProfile?.instructor.id, isExpandedProfileLoading, showAllReviewsFor, items.length]);

  useEffect(() => {
    if (!expandedId) return;
    const index = items.findIndex((row) => row.id === expandedId);
    if (index < 0) return;
    const frame = window.requestAnimationFrame(() => {
      virtualizer.scrollToIndex(index, { align: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scroll when анкета opens from map
  }, [expandedId, items]);

  return (
    <div
      ref={parentRef}
      className="max-h-[min(70vh,720px)] overflow-y-auto overscroll-contain rounded-md border border-border/60 pr-1"
      aria-label="Список инструкторов"
      role="list"
    >
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const i = items[virtualRow.index]!;
          const rowAvatar = instructorListAvatar(i);
          const expandedIns =
            expandedId === i.id &&
            expandedProfile &&
            expandedProfile.instructor.id === expandedId &&
            expandedProfile.instructor.id === i.id
              ? expandedProfile.instructor
              : null;

          return (
            <div
              key={i.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              role="listitem"
              className="absolute left-0 top-0 w-full px-1 pb-2"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <div
                className={`rounded-lg border bg-gradient-to-br from-sky-50/70 to-background p-3 text-sm transition-colors dark:from-slate-900 ${
                  selectedId === i.id ? "border-accent ring-1 ring-accent" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-between gap-3 text-left"
                    onClick={() => setSelectedId(i.id)}
                  >
                    <span className="flex items-center gap-3">
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
                          Фото
                        </span>
                        {rowAvatar ? (
                          <InstructorPhoto
                            src={rowAvatar}
                            alt={i.name ?? "Инструктор"}
                            size={40}
                            className="relative z-[1] h-full w-full"
                          />
                        ) : null}
                      </span>
                      <span>
                        <span className="block font-medium">{i.name || "Имя Фамилия не указаны"}</span>
                        <span className="block text-xs text-muted-foreground">
                          Возраст: {i.age ?? "—"}
                          {i.isOnline ? (
                            <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                              на линии
                            </span>
                          ) : (
                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              офлайн
                            </span>
                          )}
                          {i.distanceKm >= 9000 ? (
                            <span className="ml-2 text-[10px] text-muted-foreground">нет координат</span>
                          ) : null}
                        </span>
                        {i.workDistrict ? (
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            Район · {i.workDistrict}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {i.distanceKm >= 9000 ? "—" : `${i.distanceKm} км`}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Показать полный профиль"
                    aria-expanded={expandedId === i.id}
                    onClick={() =>
                      setExpandedId((prev) => {
                        const next = prev === i.id ? null : i.id;
                        if (next) setSelectedId(next);
                        if (next !== i.id) setShowAllReviewsFor(null);
                        return next;
                      })
                    }
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        expandedId === i.id ? "rotate-180" : ""
                      }`}
                    />
                  </Button>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{i.hourlyRate} ₽/час</span>
                  {i.lessonsForDiscipline != null ? (
                    <span>· {i.lessonsForDiscipline} занятий по направлению</span>
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {i.ratingAvg.toFixed(1)} ({i.reviewCount})
                  </span>
                  <span>
                    <span className="font-medium text-foreground">Языки · </span>
                    {i.languages.length ? i.languages.join(", ") : "—"}
                  </span>
                </div>
                {i.specializations.length ? (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">Специализации · </span>
                    {i.specializations.join(", ")}
                  </div>
                ) : null}

                {expandedId === i.id ? (
                  <div className="mt-3 space-y-3 rounded-md border border-border bg-background/90 p-3">
                    {isExpandedProfileError ? (
                      <p className="text-sm text-destructive">
                        Не удалось загрузить профиль. Нажмите «Обновить» выше или разверните карточку ещё
                        раз.
                      </p>
                    ) : isExpandedProfileLoading || !expandedIns ? (
                      <Skeleton className="h-28 w-full" />
                    ) : (
                      <InstructorSearchExpandedBody
                        instructor={expandedIns}
                        listItemId={i.id}
                        showAllReviewsFor={showAllReviewsFor}
                        setShowAllReviewsFor={setShowAllReviewsFor}
                        setPhotoPreview={setPhotoPreview}
                        setSelectedId={setSelectedId}
                        onStartCheckout={onStartCheckout}
                      />
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
