"use client";

import { create } from "zustand";

type View = "prompt" | "blocked";

type State = {
  open: boolean;
  view: View;
  showPrompt: () => void;
  showBlocked: () => void;
  close: () => void;
};

export const useGeolocationDialog = create<State>((set) => ({
  open: false,
  view: "prompt",
  showPrompt: () => set({ open: true, view: "prompt" }),
  showBlocked: () => set({ open: true, view: "blocked" }),
  close: () => set({ open: false }),
}));

const DISMISS_KEY = "skiinstruct-geo-prompt-dismissed";

export function isGeolocationPromptDismissed(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(DISMISS_KEY) === "1";
}

export function dismissGeolocationPrompt(): void {
  sessionStorage.setItem(DISMISS_KEY, "1");
}
