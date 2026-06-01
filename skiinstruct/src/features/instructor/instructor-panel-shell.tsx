"use client";

import { InstructorLessonSoonPrompt } from "@/features/instructor/instructor-lesson-soon-prompt";
import { InstructorPendingOrderPrompt } from "@/features/instructor/instructor-pending-order-prompt";

export function InstructorPanelShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <InstructorPendingOrderPrompt />
      <InstructorLessonSoonPrompt />
    </>
  );
}
