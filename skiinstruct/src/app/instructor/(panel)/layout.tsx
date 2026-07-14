import { InstructorPanelShell } from "@/features/instructor/instructor-panel-shell";
import {
  redirectInstructorUnlessVerified,
  redirectToRoleCabinetUnless,
} from "@/lib/auth-server-redirect";

/** Кабинет инструктора — только INSTRUCTOR с одобренной анкетой. */
export default async function InstructorPanelLayout({ children }: { children: React.ReactNode }) {
  await redirectToRoleCabinetUnless("INSTRUCTOR", "/instructor/login");
  await redirectInstructorUnlessVerified();
  return <InstructorPanelShell>{children}</InstructorPanelShell>;
}
