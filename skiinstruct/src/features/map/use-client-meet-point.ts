"use client";

import { create } from "zustand";
import { useEffect } from "react";

import { DEFAULT_SKI_RESORT_CENTER } from "@/lib/services/geo";

type State = {
  meetLat: number;
  meetLng: number;
  setMeet: (lat: number, lng: number) => void;
};

export const useMeetPoint = create<State>((set) => ({
  meetLat: DEFAULT_SKI_RESORT_CENTER.lat,
  meetLng: DEFAULT_SKI_RESORT_CENTER.lng,
  setMeet: (meetLat, meetLng) => set({ meetLat, meetLng }),
}));

/** Try GPS once for meeting point (client booking flow). */
export function useGeolocationMeetInit() {
  const setMeet = useMeetPoint((s) => s.setMeet);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (p) => setMeet(p.coords.latitude, p.coords.longitude),
      () => {
        /* keep defaults */
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }, [setMeet]);
}
