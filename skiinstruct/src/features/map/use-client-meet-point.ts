"use client";

import { create } from "zustand";

import { DEFAULT_SKI_RESORT_CENTER } from "@/lib/services/geo";

export type MeetCoordSource = "default" | "map" | "search" | "gps";

type State = {
  meetLat: number;
  meetLng: number;
  meetAddress: string;
  coordSource: MeetCoordSource;
  setMeet: (lat: number, lng: number, source?: MeetCoordSource) => void;
  setMeetAddress: (address: string) => void;
};

export const useMeetPoint = create<State>((set) => ({
  meetLat: DEFAULT_SKI_RESORT_CENTER.lat,
  meetLng: DEFAULT_SKI_RESORT_CENTER.lng,
  meetAddress: "",
  coordSource: "default",
  setMeet: (meetLat, meetLng, source = "map") => set({ meetLat, meetLng, coordSource: source }),
  setMeetAddress: (meetAddress) => set({ meetAddress }),
}));

/** Запросить GPS и обновить точку встречи (кнопка «Найти меня» на карте). */
export function locateUserMeetPoint(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("GEO_UNSUPPORTED"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        useMeetPoint.getState().setMeet(p.coords.latitude, p.coords.longitude, "gps");
        resolve();
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error("GEO_DENIED"));
        else reject(new Error("GEO_FAIL"));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  });
}

