"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  EventCatalogNavShell,
  type CatalogNavPanelDef,
} from "@/features/events/event-catalog-nav-shell";
import { InstructorCatalogJoinPanel } from "@/features/instructor/instructor-catalog-join-panel";
import {
  InstructorEventsEditor,
  type EventCreateLeaveGuard,
} from "@/features/instructor/instructor-events-editor";
import {
  FALLBACK_MAP_CITY,
  getMapCityBySlug,
} from "@/lib/map-city-centers";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent } from "@/shared/ui/dialog";

const CITY_STORAGE_KEY = "skiinstruct_instructor_catalog_city";

type InstructorCatalogPanel = "create" | "cards" | "mine" | "saved" | "past";

const PANEL_LABELS: Record<InstructorCatalogPanel, string> = {
  create: "Создать мероприятие",
  cards: "Карточки каталога",
  mine: "Мои мероприятия",
  saved: "Сохранённые мероприятия",
  past: "Прошедшие мероприятия",
};

const INSTRUCTOR_PANELS: readonly CatalogNavPanelDef<InstructorCatalogPanel>[] = [
  { id: "create", label: PANEL_LABELS.create, variant: "secondary" },
  { id: "cards", label: PANEL_LABELS.cards, variant: "outline" },
  { id: "mine", label: PANEL_LABELS.mine, variant: "outline" },
  { id: "saved", label: PANEL_LABELS.saved, variant: "outline" },
  { id: "past", label: PANEL_LABELS.past, variant: "outline" },
];

function readStoredCitySlug(): string {
  try {
    const stored = localStorage.getItem(CITY_STORAGE_KEY);
    if (stored && getMapCityBySlug(stored)) return stored;
  } catch {
    /* ignore */
  }
  return FALLBACK_MAP_CITY.slug;
}

type ActiveOrderOption = { id: string; label: string };

/**
 * Каталог мероприятий инструктора — тот же каркас, что у админа:
 * город + кнопки с провалом в отдельный блок.
 * Без админских действий (публикация/архив каталога и т.п.).
 */
export function InstructorEventCatalogSection({
  activeOrders = [],
}: {
  activeOrders?: ActiveOrderOption[];
}) {
  const [citySlug, setCitySlug] = useState(FALLBACK_MAP_CITY.slug);
  const [cityReady, setCityReady] = useState(false);
  const [activePanel, setActivePanel] = useState<InstructorCatalogPanel | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [pendingPanel, setPendingPanel] = useState<InstructorCatalogPanel | null | undefined>(
    undefined,
  );
  const leaveGuardRef = useRef<EventCreateLeaveGuard | null>(null);
  const pendingCitySlugRef = useRef<string | null>(null);

  useEffect(() => {
    setCitySlug(readStoredCitySlug());
    setCityReady(true);
  }, []);

  const selectedCity = getMapCityBySlug(citySlug) ?? FALLBACK_MAP_CITY;

  const applyPanelChange = useCallback((next: InstructorCatalogPanel | null) => {
    setActivePanel(next);
    setPendingPanel(undefined);
    setLeaveOpen(false);
  }, []);

  const requestPanelChange = useCallback(
    (next: InstructorCatalogPanel | null) => {
      if (
        activePanel === "create" &&
        next !== "create" &&
        leaveGuardRef.current?.shouldConfirmLeave()
      ) {
        setPendingPanel(next);
        setLeaveOpen(true);
        return;
      }
      applyPanelChange(next);
    },
    [activePanel, applyPanelChange],
  );

  function changeCity(nextSlug: string) {
    const city = getMapCityBySlug(nextSlug);
    if (!city) return;
    if (activePanel === "create" && leaveGuardRef.current?.shouldConfirmLeave()) {
      pendingCitySlugRef.current = city.slug;
      setPendingPanel(null);
      setLeaveOpen(true);
      return;
    }
    pendingCitySlugRef.current = null;
    setCitySlug(city.slug);
    try {
      localStorage.setItem(CITY_STORAGE_KEY, city.slug);
    } catch {
      /* ignore */
    }
    applyPanelChange(null);
  }

  async function resolveLeave(action: "save" | "discard" | "cancel") {
    if (action === "cancel") {
      setLeaveOpen(false);
      setPendingPanel(undefined);
      pendingCitySlugRef.current = null;
      return;
    }
    const guard = leaveGuardRef.current;
    setLeaveBusy(true);
    try {
      if (action === "save") {
        const ok = await guard?.save();
        if (!ok) return;
      } else {
        guard?.discard();
      }
      const citySlugPending = pendingCitySlugRef.current;
      pendingCitySlugRef.current = null;
      if (citySlugPending) {
        const city = getMapCityBySlug(citySlugPending);
        if (city) {
          setCitySlug(city.slug);
          try {
            localStorage.setItem(CITY_STORAGE_KEY, city.slug);
          } catch {
            /* ignore */
          }
        }
      }
      applyPanelChange(pendingPanel === undefined ? null : pendingPanel);
    } finally {
      setLeaveBusy(false);
    }
  }

  const onLeaveGuardReady = useCallback((guard: EventCreateLeaveGuard | null) => {
    leaveGuardRef.current = guard;
  }, []);

  if (!cityReady) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }

  const listViews: InstructorCatalogPanel[] = ["mine", "saved", "past"];

  return (
    <>
      <EventCatalogNavShell
        citySlug={citySlug}
        cityName={selectedCity.name}
        citySelectId="inst-events-catalog-city"
        onCityChange={changeCity}
        panels={INSTRUCTOR_PANELS}
        activePanel={activePanel}
        onActivePanelChange={requestPanelChange}
        panelLabels={PANEL_LABELS}
        cityDescription="Выберите город — каталог карточек и создание мероприятий ориентируются на него."
        emptyHint="Выберите раздел выше: создать мероприятие, каталог, мои, сохранённые или прошедшие."
      >
        {activePanel === "create" || (activePanel && listViews.includes(activePanel)) ? (
          <div className="space-y-3">
            {activePanel === "create" ? (
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Новое мероприятие · {selectedCity.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Черновик → «На модерацию» → после одобрения видно в ленте и на карте.
                </p>
              </div>
            ) : activePanel === "saved" ? (
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Сохранённые мероприятия · {selectedCity.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Черновики, которые вы сохранили и ещё не отправили на проверку.
                </p>
              </div>
            ) : activePanel === "past" ? (
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Прошедшие мероприятия · {selectedCity.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Мероприятия, у которых уже прошла дата и время.
                </p>
              </div>
            ) : (
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Мои мероприятия · {selectedCity.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  На модерации, опубликованные, отклонённые и скрытые. Редактирование откроет форму
                  создания.
                </p>
              </div>
            )}
            <InstructorEventsEditor
              activeOrders={activeOrders}
              embedded
              view={
                activePanel === "create"
                  ? "create"
                  : activePanel === "saved"
                    ? "saved"
                    : activePanel === "past"
                      ? "past"
                      : "list"
              }
              onRequestCreateView={() => requestPanelChange("create")}
              onLeaveGuardReady={onLeaveGuardReady}
            />
          </div>
        ) : null}

        {activePanel === "cards" ? (
          <InstructorCatalogJoinPanel
            embedded
            hideCityPicker
            citySlug={citySlug}
            onCityChange={changeCity}
          />
        ) : null}
      </EventCatalogNavShell>

      <Dialog
        open={leaveOpen}
        onOpenChange={(open) => {
          if (!open && !leaveBusy) {
            setLeaveOpen(false);
            setPendingPanel(undefined);
            pendingCitySlugRef.current = null;
          }
        }}
      >
        <DialogContent className="gap-0 p-0">
          <div className="space-y-2 border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold">Сохранить мероприятие?</h2>
            <p className="text-sm text-muted-foreground">
              Вы уходите со страницы создания, не отправив мероприятие на проверку. Сохранить как
              черновик в «Сохранённые мероприятия»?
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              disabled={leaveBusy}
              onClick={() => void resolveLeave("cancel")}
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={leaveBusy}
              onClick={() => void resolveLeave("discard")}
            >
              Не сохранять
            </Button>
            <Button
              type="button"
              variant="accent"
              disabled={leaveBusy}
              onClick={() => void resolveLeave("save")}
            >
              {leaveBusy ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
