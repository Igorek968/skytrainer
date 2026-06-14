import { Prisma } from "@prisma/client";

import { parseProfileDraft } from "@/lib/instructor-profile-draft";
import { prisma } from "@/lib/prisma";
import {
  buildDisplayNameKey,
  displayNameKeyFromFullName,
} from "@/lib/user-display-name";

/** Есть ли другой участник с тем же именем и фамилией. */
export async function findDuplicateParticipantByDisplayName(
  excludeUserId: string | null,
  firstName: string,
  lastName: string,
): Promise<boolean> {
  const key = buildDisplayNameKey(firstName, lastName);
  if (!key) return false;

  const users = await prisma.user.findMany({
    where: {
      name: { not: null },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { name: true },
  });

  for (const user of users) {
    if (displayNameKeyFromFullName(user.name) === key) return true;
  }

  const pendingDrafts = await prisma.instructorProfile.findMany({
    where: {
      profileDraftStatus: "PENDING_REVIEW",
      profileDraft: { not: Prisma.JsonNull },
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
    select: { profileDraft: true },
  });

  for (const row of pendingDrafts) {
    const draft = parseProfileDraft(row.profileDraft);
    if (!draft) continue;
    const draftKey = buildDisplayNameKey(draft.firstName ?? "", draft.lastName ?? "");
    if (draftKey === key) return true;
  }

  return false;
}
