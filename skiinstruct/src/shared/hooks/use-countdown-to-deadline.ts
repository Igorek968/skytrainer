"use client";

import { useEffect, useState } from "react";

function secondsUntil(deadlineMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
}

/** Секунды до deadlineMs; обновление раз в секунду. null — таймер выключен. */
export function useCountdownToDeadline(deadlineMs: number | null, enabled = true): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => {
    if (!enabled || deadlineMs == null) return null;
    return secondsUntil(deadlineMs);
  });

  useEffect(() => {
    if (!enabled || deadlineMs == null) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => setSecondsLeft(secondsUntil(deadlineMs));
    tick();
    const timerId = window.setInterval(tick, 1000);
    return () => window.clearInterval(timerId);
  }, [deadlineMs, enabled]);

  return secondsLeft;
}
