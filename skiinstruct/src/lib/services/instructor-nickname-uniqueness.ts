import { Prisma } from "@prisma/client";

import {
  nicknameToProfileSlug,
  normalizeNicknameKey,
} from "@/lib/instructor-profile-slug";
import { parseProfileDraft } from "@/lib/instructor-profile-draft";
import { prisma } from "@/lib/prisma";

export async function findDuplicateInstructorNickname(
  excludeUserId: string | null,
  nickname: string,
): Promise<boolean> {
  const key = normalizeNicknameKey(nickname);
  const slug = nicknameToProfileSlug(nickname);
  if (!key) return false;

  const users = await prisma.user.findMany({
    where: {
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      OR: [
        ...(slug ? [{ profileSlug: slug }] : []),
        { nickname: { equals: nickname.trim(), mode: "insensitive" } },
      ],
    },
    select: { nickname: true, profileSlug: true },
    take: 50,
  });

  for (const user of users) {
    if (slug && user.profileSlug === slug) return true;
    if (user.nickname && normalizeNicknameKey(user.nickname) === key) return true;
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
    const draftNick = draft?.nickname?.trim() ?? "";
    if (!draftNick) continue;
    if (normalizeNicknameKey(draftNick) === key) return true;
    const draftSlug = nicknameToProfileSlug(draftNick);
    if (slug && draftSlug === slug) return true;
  }

  return false;
}

/** Записать уникальный profileSlug. Для уже существующих при коллизии добавляет -2, -3. */
export async function persistInstructorProfileSlug(
  userId: string,
  nickname: string,
  options?: { allowNumericSuffix?: boolean },
): Promise<string | null> {
  const base = nicknameToProfileSlug(nickname);
  if (!base) {
    await prisma.user.update({
      where: { id: userId },
      data: { profileSlug: null },
    });
    return null;
  }

  const allowSuffix = options?.allowNumericSuffix === true;
  const max = allowSuffix ? 30 : 1;

  for (let n = 0; n < max; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const taken = await prisma.user.findFirst({
      where: { profileSlug: candidate, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) continue;
    await prisma.user.update({
      where: { id: userId },
      data: { profileSlug: candidate },
    });
    return candidate;
  }

  return null;
}

export async function resolveInstructorByPublicKey(raw: string): Promise<{
  id: string;
  profileSlug: string | null;
  nickname: string | null;
} | null> {
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    /* already decoded */
  }
  const slug = decoded.trim().toLowerCase();
  if (!slug) return null;

  const bySlug = await prisma.user.findFirst({
    where: { role: "INSTRUCTOR", profileSlug: slug },
    select: { id: true, profileSlug: true, nickname: true },
  });
  if (bySlug) return bySlug;

  const byId = await prisma.user.findFirst({
    where: { id: decoded, role: "INSTRUCTOR" },
    select: { id: true, profileSlug: true, nickname: true },
  });
  if (byId) {
    if (!byId.profileSlug && byId.nickname) {
      const slugSaved = await persistInstructorProfileSlug(byId.id, byId.nickname, {
        allowNumericSuffix: true,
      });
      return { ...byId, profileSlug: slugSaved };
    }
    return byId;
  }

  return null;
}
