"use client";

import { useEffect, useState } from "react";

import { DISPLAY_NAME_DUPLICATE_MESSAGE } from "@/lib/user-display-name";

export function useDisplayNameDuplicateCheck(
  firstName: string,
  lastName: string,
  enabled = true,
): { duplicate: boolean; checking: boolean; message: string | null } {
  const [duplicate, setDuplicate] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDuplicate(false);
      setChecking(false);
      return;
    }

    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last) {
      setDuplicate(false);
      setChecking(false);
      return;
    }

    setChecking(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const qs = new URLSearchParams({ firstName: first, lastName: last });
          const r = await fetch(`/api/display-name/check?${qs}`, { credentials: "include" });
          const j = (await r.json()) as { duplicate?: boolean; message?: string | null };
          if (!r.ok) {
            setDuplicate(false);
            return;
          }
          setDuplicate(Boolean(j.duplicate));
        } catch {
          setDuplicate(false);
        } finally {
          setChecking(false);
        }
      })();
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [firstName, lastName, enabled]);

  return {
    duplicate,
    checking,
    message: duplicate ? DISPLAY_NAME_DUPLICATE_MESSAGE : null,
  };
}
