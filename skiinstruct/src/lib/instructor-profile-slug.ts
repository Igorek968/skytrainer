import { slugifyRu } from "@/lib/seo-slug";

export const NICKNAME_TAKEN_MESSAGE =
  "Этот никнейм уже занят. Укажите другой — ссылка на анкету должна быть уникальной.";

export const NICKNAME_SLUG_INVALID_MESSAGE =
  "Никнейм должен содержать буквы или цифры: из него получается ссылка на анкету.";

const RESERVED_PROFILE_SLUGS = new Set([
  "page",
  "new",
  "me",
  "search",
  "reviews",
  "admin",
  "apply",
  "instructors",
]);

export function normalizeNicknameKey(nickname: string): string {
  return nickname
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

/** Латинский slug для URL из никнейма. */
export function nicknameToProfileSlug(nickname: string): string | null {
  const slug = slugifyRu(nickname.trim());
  if (!slug || RESERVED_PROFILE_SLUGS.has(slug) || slug.length < 2) return null;
  return slug;
}

export function instructorPublicPath(user: {
  id: string;
  profileSlug?: string | null;
  nickname?: string | null;
}): string {
  const stored = user.profileSlug?.trim().toLowerCase();
  if (stored && !RESERVED_PROFILE_SLUGS.has(stored)) {
    return `/instructors/${stored}`;
  }
  const fromNick = nicknameToProfileSlug(user.nickname ?? "");
  if (fromNick) return `/instructors/${fromNick}`;
  return `/instructors/${user.id}`;
}

export function instructorPublicReviewsPath(user: {
  id: string;
  profileSlug?: string | null;
  nickname?: string | null;
}): string {
  return `${instructorPublicPath(user)}/reviews`;
}
