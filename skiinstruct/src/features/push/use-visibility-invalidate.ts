"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/** При возврате в PWA (Android) — сразу обновить оповещения. */
export function useVisibilityInvalidate(queryKeys: readonly (readonly unknown[])[]) {
  const qc = useQueryClient();

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      for (const key of queryKeys) {
        void qc.invalidateQueries({ queryKey: key as unknown[] });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [qc, queryKeys]);
}
