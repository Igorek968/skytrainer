import type { InstructorVerificationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Кабинет только после APPROVED; иначе — экран ожидания модерации. */
export function instructorEntryPath(
  status: InstructorVerificationStatus | null | undefined,
): string {
  return status === "APPROVED" ? "/instructor" : "/instructor/pending";
}

export async function getInstructorVerificationStatus(
  userId: string,
): Promise<InstructorVerificationStatus | null> {
  const profile = await prisma.instructorProfile.findUnique({
    where: { userId },
    select: { verificationStatus: true },
  });
  return profile?.verificationStatus ?? null;
}
