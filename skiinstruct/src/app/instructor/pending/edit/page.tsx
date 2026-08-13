import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { InstructorApplicationEditClient } from "@/app/instructor/pending/edit/instructor-application-edit-client";
import { EmailVerificationGate } from "@/features/auth/email-verification-gate";
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
  title: `Редактирование анкеты · ${getPublicProductName()}`,
};

export default async function InstructorApplicationEditPage() {
  await redirectToRoleCabinetUnless("INSTRUCTOR", "/instructor/login");

  const row = await getDbRoleForSession();
  if (!row) {
    redirect("/instructor/login");
  }

  const status = await getInstructorVerificationStatus(row.userId);
  if (status === "APPROVED") {
    redirect(instructorEntryPath(status));
  }
  if (status === "PENDING") {
    redirect("/instructor/pending");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-2">
      <Suspense fallback={null}>
        <EmailVerificationGate role="INSTRUCTOR" />
      </Suspense>
      <InstructorApplicationEditClient />
    </div>
  );
}
