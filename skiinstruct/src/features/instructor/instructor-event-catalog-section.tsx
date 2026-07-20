"use client";

import { useEffect, useState } from "react";

import {
  EventCatalogNavShell,
  type CatalogNavPanelDef,
} from "@/features/events/event-catalog-nav-shell";
import { InstructorCatalogJoinPanel } from "@/features/instructor/instructor-catalog-join-panel";
import { InstructorEventsEditor } from "@/features/instructor/instructor-events-editor";
import {
  FALLBACK_MAP_CITY,
  getMapCityBySlug,
} from "@/lib/map-city-centers";

const CITY_STORAGE_KEY = "skiinstruct_instructor_catalog_city";

type InstructorCatalogPanel = "create" | "cards" | "mine";

const PANEL_LABELS: Record<InstructorCatalogPanel, string> = {
  create: "Создать мероприятие",
  cards: "Карточки каталога",
  mine: "Мои мероприятия",
};

const INSTRUCTOR_PANELS: readonly CatalogNavPanelDef<InstructorCatalogPanel>[] = [
  { id: "create", label: PANEL_LABELS.create, variant: "secondary" },
  { id: "cards", label: PANEL_LABELS.cards, variant: "outline" },
  { id: "mine", label: PANEL_LABELS.mine, variant: "outline" },
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

  useEffect(() => {
    setCitySlug(readStoredCitySlug());
    setCityReady(true);
  }, []);

  const selectedCity = getMapCityBySlug(citySlug) ?? FALLBACK_MAP_CITY;

  function changeCity(nextSlug: string) {
    const city = getMapCityBySlug(nextSlug);
    if (!city) return;
    setCitySlug(city.slug);
    try {
      localStorage.setItem(CITY_STORAGE_KEY, city.slug);
    } catch {
      /* ignore */
    }
    setActivePanel(null);
  }

  if (!cityReady) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }

  return (
    <EventCatalogNavShell
      citySlug={citySlug}
      cityName={selectedCity.name}
      citySelectId="inst-events-catalog-city"
      onCityChange={changeCity}
      panels={INSTRUCTOR_PANELS}
      activePanel={activePanel}
      onActivePanelChange={setActivePanel}
      panelLabels={PANEL_LABELS}
      cityDescription="Выберите город — каталог карточек и создание мероприятий ориентируются на него."
      emptyHint="Выберите раздел выше: создать своё мероприятие, присоединиться к карточке каталога или открыть свои."
    >
      {activePanel === "create" || activePanel === "mine" ? (
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
          ) : (
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Мои мероприятия · {selectedCity.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                Черновики, модерация, опубликованные и скрытые. Редактирование откроет форму создания.
              </p>
            </div>
          )}
          <InstructorEventsEditor
            activeOrders={activeOrders}
            embedded
            view={activePanel === "create" ? "create" : "list"}
            onRequestCreateView={() => setActivePanel("create")}
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
  );
}
