import { getInstructorVerificationStatus, instructorEntryPath } from "@/lib/instructor-verification-gate";
import { prisma } from "@/lib/prisma";

/** Куда вести после подтверждения email (с сессией). */
export async function cabinetPathAfterEmailVerification(email: string): Promise<{
  role: string | null;
  redirectTo: string;
}> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    select: { id: true, role: true },
  });
  if (!user) {
    return { role: null, redirectTo: "/client?emailVerified=1" };
  }
  if (user.role === "INSTRUCTOR") {
    const status = await getInstructorVerificationStatus(user.id);
    return {
      role: user.role,
      redirectTo: `${instructorEntryPath(status)}?emailVerified=1`,
    };
  }
  if (user.role === "ADMIN" || user.role === "MODERATOR") {
    return { role: user.role, redirectTo: "/admin/metrics?emailVerified=1" };
  }
  return { role: user.role, redirectTo: "/client?emailVerified=1" };
}
