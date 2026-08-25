import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { cabinetPathForRole } from "@/lib/auth-routes";
import {
  getInstructorVerificationStatus,
  instructorEntryPath,
} from "@/lib/instructor-verification-gate";

export const metadata: Metadata = {
  title: "ТвойТренер",
  robots: { index: false, follow: false },
};

/**
 * Точка входа PWA (manifest start_url).
 * Гость и клиент — карта. Инструктор — кабинет или экран модерации.
 */
export default async function AppEntryPage() {
  const session = await auth();
  const role = session?.user?.role;
  const userId = session?.user?.id?.trim();

  if (role === "INSTRUCTOR" && userId) {
    const status = await getInstructorVerificationStatus(userId);
    redirect(instructorEntryPath(status));
  }

  if (role === "ADMIN" || role === "MODERATOR" || role === "CLIENT") {
    redirect(cabinetPathForRole(role) ?? "/client");
  }

  redirect("/client");
}
