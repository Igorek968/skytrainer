"use client";

import { useMeetPoint } from "@/features/map/use-client-meet-point";

export type GeolocationErrorCode = "GEO_DENIED" | "GEO_UNSUPPORTED" | "GEO_FAIL" | "GEO_INSECURE";

export function geolocationErrorCode(err: unknown): GeolocationErrorCode {
  if (err instanceof Error) {
    if (err.message === "GEO_DENIED") return "GEO_DENIED";
    if (err.message === "GEO_UNSUPPORTED") return "GEO_UNSUPPORTED";
    if (err.message === "GEO_INSECURE") return "GEO_INSECURE";
  }
  return "GEO_FAIL";
}

/** Запрос GPS — вызывать только из обработчика нажатия (иначе Android не покажет системный диалог). */
export function requestUserGeolocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("GEO_UNSUPPORTED"));
      return;
    }
    if (!window.isSecureContext) {
      reject(new Error("GEO_INSECURE"));
      return;
    }
    if (!navigator.geolocation) {
      reject(new Error("GEO_UNSUPPORTED"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error("GEO_DENIED"));
        else reject(new Error("GEO_FAIL"));
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  });
}

export function applyGeolocationToMeetPoint(position: GeolocationPosition): void {
  useMeetPoint
    .getState()
    .setMeet(position.coords.latitude, position.coords.longitude, "gps");
}

/** Обновить точку встречи по GPS (кнопка «Найти меня» на карте). */
export function locateUserMeetPoint(): Promise<void> {
  return requestUserGeolocation().then((position) => {
    applyGeolocationToMeetPoint(position);
  });
}
