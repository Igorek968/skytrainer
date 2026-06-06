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

export { locateUserMeetPoint } from "@/features/map/request-user-geolocation";
