"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { clearFormDraft, readFormDraft, saveFormDraft } from "@/lib/form-draft-storage";

/** Контролируемая форма с автосохранением в sessionStorage. */
export function useFormDraft<T extends Record<string, unknown>>(
  storageKey: string,
  defaults: T,
): {
  values: T;
  setValues: (patch: Partial<T> | ((prev: T) => T)) => void;
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  clearDraft: () => void;
} {
  const defaultsRef = useRef(defaults);
  const [values, setValuesState] = useState<T>(() => {
    const saved = readFormDraft<T>(storageKey);
    return saved ? { ...defaultsRef.current, ...saved } : defaultsRef.current;
  });

  const persist = useCallback(
    (next: T) => {
      saveFormDraft(storageKey, next);
    },
    [storageKey],
  );

  const setValues = useCallback(
    (patch: Partial<T> | ((prev: T) => T)) => {
      setValuesState((prev) => {
        const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const setField = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    [setValues],
  );

  const clearDraft = useCallback(() => {
    clearFormDraft(storageKey);
  }, [storageKey]);

  useEffect(() => {
    persist(values);
  }, [values, persist]);

  return { values, setValues, setField, clearDraft };
}
