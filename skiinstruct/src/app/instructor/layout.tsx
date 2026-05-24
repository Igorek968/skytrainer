import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Кабинет инструктора · SkiInstruct",
    template: "%s · SkiInstruct",
  },
};

/** /instructor/login и /instructor/apply — без проверки сессии (см. (panel)/layout). */
export default function InstructorSegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
