import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { InstructorPendingModerationClient } from "@/app/instructor/pending/instructor-pending-moderation-client";
import {
  getDbRoleForSession,
  redirectToRoleCabinetUnless,
} from "@/lib/auth-server-redirect";
import {
  getInstructorVerificationStatus,
  instructorEntryPath,
} from "@/lib/instructor-verification-gate";
import { getPublicProductName } from "@/shared/lib/product";

export const metadata: Metadata = {
  title: `Ожидание модерации · ${getPublicProductName()}`,
};

export default async function InstructorPendingPage() {
  await redirectToRoleCabinetUnless("INSTRUCTOR", "/instructor/login");

  const row = await getDbRoleForSession();
  if (!row) {
    redirect("/instructor/login");
  }

  const status = await getInstructorVerificationStatus(row.userId);
  if (status === "APPROVED") {
    redirect(instructorEntryPath(status));
  }

  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Загрузка…</p>}>
      <InstructorPendingModerationClient />
    </Suspense>
  );
}
