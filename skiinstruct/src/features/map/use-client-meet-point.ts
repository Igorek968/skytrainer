"use client";

import { create } from "zustand";

import { FALLBACK_MAP_CITY } from "@/lib/map-city-centers";

export type MeetCoordSource = "default" | "map" | "search" | "gps" | "city";

type State = {
  meetLat: number;
  meetLng: number;
  meetAddress: string;
  coordSource: MeetCoordSource;
  setMeet: (lat: number, lng: number, source?: MeetCoordSource) => void;
  setMeetAddress: (address: string) => void;
};

export const useMeetPoint = create<State>((set) => ({
  meetLat: FALLBACK_MAP_CITY.lat,
  meetLng: FALLBACK_MAP_CITY.lng,
  meetAddress: "",
  coordSource: "default",
  setMeet: (meetLat, meetLng, source = "map") => set({ meetLat, meetLng, coordSource: source }),
  setMeetAddress: (meetAddress) => set({ meetAddress }),
}));

export { locateUserMeetPoint } from "@/features/map/request-user-geolocation";
