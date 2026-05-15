"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

const INTERVAL_MS = 30_000;

/**
 * Instructor: push GPS to server at most once per 30s (and on first fix).
 */
export function useThrottledInstructorLocation(enabled: boolean) {
  const { data: session, status } = useSession();
  const last = useRef(0);
  const watch = useRef<number | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !enabled) return;
    if (session?.user?.role !== "INSTRUCTOR") return;
    if (!navigator.geolocation) return;

    const send = (lat: number, lng: number) => {
      const now = Date.now();
      if (now - last.current < INTERVAL_MS) return;
      last.current = now;
      void fetch("/api/instructor/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
    };

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        send(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        /* user denied or error */
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
    );
    watch.current = id;

    return () => {
      if (watch.current != null) {
        navigator.geolocation.clearWatch(watch.current);
      }
    };
  }, [enabled, session?.user?.role, status]);
}
