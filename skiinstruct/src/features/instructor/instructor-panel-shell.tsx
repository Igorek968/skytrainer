"use client";

import { InstructorLessonSoonPrompt } from "@/features/instructor/instructor-lesson-soon-prompt";
import { InstructorPendingOrderPrompt } from "@/features/instructor/instructor-pending-order-prompt";
import { unlockInstructorOrderBeep } from "@/features/instructor/instructor-order-beep";
import { useEffect } from "react";

export function InstructorPanelShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const unlock = () => unlockInstructorOrderBeep();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission().catch(() => {});
    }

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return (
    <>
      {children}
      <InstructorPendingOrderPrompt />
      <InstructorLessonSoonPrompt />
    </>
  );
}
