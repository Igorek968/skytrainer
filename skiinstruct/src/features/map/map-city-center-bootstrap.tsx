"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  applyGeolocationToMeetPoint,
  probeUserGeolocation,
} from "@/features/map/request-user-geolocation";
import { useMeetPoint } from "@/features/map/use-client-meet-point";
import { getMapCityBySlug } from "@/lib/map-city-centers";

const SESSION_KEY = "skiinstruct_map_city_center_v1";

type StoredCenter = { lat: number; lng: number; source: "city" | "gps" };

function readStored(): StoredCenter | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCenter;
    if (
      typeof parsed.lat === "number" &&
      typeof parsed.lng === "number" &&
      Number.isFinite(parsed.lat) &&
      Number.isFinite(parsed.lng)
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeStored(center: StoredCenter) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(center));
  } catch {
    /* ignore */
  }
}

/**
 * При открытии сайта выставляет центр карт на город посетителя:
 * 1) сохранённый в сессии / GPS → центр города;
 * 2) страница /gorod/[slug] → центр этого города;
 * 3) иначе IP → ближайший город из каталога.
 */
export function MapCityCenterBootstrap() {
  const pathname = usePathname();
  const coordSource = useMeetPoint((s) => s.coordSource);
  const setMeet = useMeetPoint((s) => s.setMeet);
  const ran = useRef(false);

  useEffect(() => {
    const m = pathname?.match(/^\/gorod\/([^/]+)/);
    const slug = m?.[1];
    if (!slug) return;
    const city = getMapCityBySlug(slug);
    if (!city) return;
    const current = useMeetPoint.getState();
    if (current.coordSource === "map" || current.coordSource === "search" || current.coordSource === "gps") {
      return;
    }
    setMeet(city.lat, city.lng, "city");
    writeStored({ lat: city.lat, lng: city.lng, source: "city" });
  }, [pathname, setMeet]);

  useEffect(() => {
    if (ran.current) return;
    if (coordSource !== "default") return;
    ran.current = true;

    const stored = readStored();
    if (stored) {
      setMeet(stored.lat, stored.lng, stored.source);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const position = await probeUserGeolocation();
        if (cancelled) return;
        applyGeolocationToMeetPoint(position);
        const s = useMeetPoint.getState();
        writeStored({
          lat: s.meetLat,
          lng: s.meetLng,
          source: s.coordSource === "gps" ? "gps" : "city",
        });
        return;
      } catch {
        /* GPS недоступен — пробуем IP */
      }

      try {
        const r = await fetch("/api/geo/suggest-city", { credentials: "same-origin" });
        if (!r.ok || cancelled) return;
        const j = (await r.json()) as { lat?: number; lng?: number };
        if (
          cancelled ||
          typeof j.lat !== "number" ||
          typeof j.lng !== "number" ||
          !Number.isFinite(j.lat) ||
          !Number.isFinite(j.lng)
        ) {
          return;
        }
        const stillDefault = useMeetPoint.getState().coordSource === "default";
        if (!stillDefault) return;
        setMeet(j.lat, j.lng, "city");
        writeStored({ lat: j.lat, lng: j.lng, source: "city" });
      } catch {
        /* leave default */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [coordSource, setMeet]);

  return null;
}
