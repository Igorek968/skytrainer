import { redirectToRoleCabinetUnless } from "@/lib/auth-server-redirect";

/** Кабинет инструктора — только для роли INSTRUCTOR (роль из БД, не из устаревшего JWT). */
export default async function InstructorPanelLayout({ children }: { children: React.ReactNode }) {
  await redirectToRoleCabinetUnless("INSTRUCTOR", "/instructor/login");
  return children;
}
