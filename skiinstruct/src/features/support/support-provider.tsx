"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { PlatformSupportDialog } from "@/features/support/platform-support-dialog";

type SupportContextValue = {
  openSupport: () => void;
};

const SupportContext = createContext<SupportContextValue | null>(null);

export function SupportProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openSupport = useCallback(() => setOpen(true), []);

  const value = useMemo(() => ({ openSupport }), [openSupport]);

  return (
    <SupportContext.Provider value={value}>
      {children}
      <PlatformSupportDialog open={open} onOpenChange={setOpen} />
    </SupportContext.Provider>
  );
}

export function useSupportLauncher(): SupportContextValue {
  const ctx = useContext(SupportContext);
  if (!ctx) {
    throw new Error("useSupportLauncher must be used within SupportProvider");
  }
  return ctx;
}
