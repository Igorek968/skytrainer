import type { Metadata } from "next";

/** Весь раздел /admin относится к приложению SkiInstruct (этот репозиторий Next.js). */
export const metadata: Metadata = {
  title: {
    default: "Администрирование · SkiInstruct",
    template: "%s · SkiInstruct Admin",
  },
  robots: { index: false, follow: false },
};

export default function AdminSegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
