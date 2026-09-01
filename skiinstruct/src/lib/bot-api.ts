import { instructorPublicPath } from "@/lib/instructor-profile-slug";
import { isDemoInstructorEmail, liveInstructorEmailWhere } from "@/lib/demo-instructor";
import { prisma } from "@/lib/prisma";
import { publicUploadAbsoluteDisplaySrc } from "@/lib/public-uploads-display";
import {
  canonicalizeActivityLabels,
  resolveInstructorListAvatar,
  specializationMatches,
} from "@/lib/services/instructor-match";

/** Общий секрет: бот → сайт (Bearer) и сайт → бот (Authorization). */
export function botApiSecret(): string | null {
  const s = process.env.BOT_API_SECRET?.trim();
  if (!s || s === "replace-with-long-random-secret") return null;
  return s;
}

/** Базовый URL бота без завершающего `/` (на него уходят POST /hooks/…). */
export function botOutboundWebhookBaseUrl(): string | null {
  const raw = process.env.BOT_OUTBOUND_WEBHOOK_BASE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export function authorizeBotApiRequest(req: Request): boolean {
  const secret = botApiSecret();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export type BotInstructorPayload = {
  id: string;
  name: string;
  sport: string;
  photo_url: string | null;
  profile_url: string;
  city: string | null;
  is_online?: boolean;
  is_urgent?: boolean;
};

export type BotEventPayload = {
  id: string;
  title: string;
  date: string | null;
  place: string | null;
  sport: string | null;
  image_url: string | null;
  signup_url: string;
};

type HookName = "instructor-approved" | "instructor-online" | "event-published";

function primarySport(specializations: string[]): string {
  const canon = canonicalizeActivityLabels(specializations);
  return canon[0] ?? specializations[0]?.trim() ?? "спорт";
}

export async function buildInstructorBotPayload(
  userId: string,
  extras?: { is_urgent?: boolean },
): Promise<BotInstructorPayload | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      nickname: true,
      profileSlug: true,
      image: true,
      email: true,
      instructorProfile: {
        select: {
          specializations: true,
          photoUrl: true,
          photoGallery: true,
          workDistrict: true,
          isOnline: true,
          verificationStatus: true,
          resort: { select: { name: true } },
        },
      },
    },
  });

  const profile = user?.instructorProfile;
  if (!user || !profile || profile.verificationStatus !== "APPROVED") return null;
  if (isDemoInstructorEmail(user.email)) return null;

  const avatar = resolveInstructorListAvatar({
    photoUrl: profile.photoUrl,
    photoGallery: profile.photoGallery,
    userImage: user.image,
  });

  return {
    id: user.id,
    name: user.name?.trim() || "Инструктор",
    sport: primarySport(profile.specializations),
    photo_url: publicUploadAbsoluteDisplaySrc(avatar),
    profile_url: absoluteUrl(instructorPublicPath(user)),
    city: profile.workDistrict?.trim() || profile.resort?.name?.trim() || null,
    is_online: profile.isOnline,
    ...(extras?.is_urgent != null ? { is_urgent: extras.is_urgent } : {}),
  };
}

export async function buildEventBotPayload(eventId: string): Promise<BotEventPayload | null> {
  const row = await prisma.instructorEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      category: true,
      photoUrl: true,
      eventAt: true,
      venueAddress: true,
      moderationStatus: true,
      catalogItem: {
        select: { title: true, venueAddress: true, eventAt: true, photoUrl: true },
      },
      slots: {
        orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
        take: 1,
        select: { startsAt: true },
      },
    },
  });

  if (!row || row.moderationStatus !== "PUBLISHED") return null;

  const title = row.catalogItem?.title?.trim() || row.title.trim();
  const place =
    row.catalogItem?.venueAddress?.trim() || row.venueAddress?.trim() || null;
  const when =
    row.catalogItem?.eventAt ?? row.eventAt ?? row.slots[0]?.startsAt ?? null;
  const image =
    row.catalogItem?.photoUrl?.trim() || row.photoUrl?.trim() || null;

  return {
    id: row.id,
    title,
    date: when ? when.toISOString().slice(0, 10) : null,
    place,
    sport: row.category?.trim() || null,
    image_url: publicUploadAbsoluteDisplaySrc(image),
    signup_url: absoluteUrl(`/events/${row.id}`),
  };
}

async function postBotHook(hook: HookName, body: unknown): Promise<void> {
  const base = botOutboundWebhookBaseUrl();
  const secret = botApiSecret();
  if (!base) return;
  if (!secret) {
    console.warn("[bot-api] BOT_OUTBOUND_WEBHOOK_BASE_URL задан, но BOT_API_SECRET пуст — webhook не отправлен");
    return;
  }

  const url = `${base}/hooks/${hook}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
        "X-Tvoytrener-Event": hook,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[bot-api] webhook ${hook} → ${res.status}`,
        text.slice(0, 300),
      );
    }
  } catch (e) {
    console.error(
      `[bot-api] webhook ${hook} failed`,
      e instanceof Error ? e.message : e,
    );
  }
}

/** Fire-and-forget: новый / одобренный инструктор. */
export function notifyBotInstructorApproved(userId: string): void {
  void (async () => {
    const payload = await buildInstructorBotPayload(userId);
    if (!payload) return;
    await postBotHook("instructor-approved", payload);
  })();
}

/** Fire-and-forget: инструктор вышел на линию. */
export function notifyBotInstructorOnline(userId: string): void {
  void (async () => {
    const payload = await buildInstructorBotPayload(userId, { is_urgent: true });
    if (!payload) return;
    await postBotHook("instructor-online", {
      id: payload.id,
      name: payload.name,
      sport: payload.sport,
      photo_url: payload.photo_url,
      profile_url: payload.profile_url,
      city: payload.city,
      is_urgent: true,
    });
  })();
}

/** Fire-and-forget: событие опубликовано. */
export function notifyBotEventPublished(eventId: string): void {
  void (async () => {
    const payload = await buildEventBotPayload(eventId);
    if (!payload) return;
    await postBotHook("event-published", payload);
  })();
}

export async function listBotInstructors(params: {
  sport?: string;
  onlineOnly: boolean;
  limit: number;
}): Promise<BotInstructorPayload[]> {
  const rows = await prisma.user.findMany({
    where: {
      role: "INSTRUCTOR",
      suspendedAt: null,
      ...liveInstructorEmailWhere,
      instructorProfile: {
        is: {
          verificationStatus: "APPROVED",
          ...(params.onlineOnly ? { isOnline: true } : {}),
        },
      },
    },
    take: Math.min(Math.max(params.limit, 1), 50) * 3,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      nickname: true,
      profileSlug: true,
      image: true,
      instructorProfile: {
        select: {
          specializations: true,
          photoUrl: true,
          photoGallery: true,
          workDistrict: true,
          isOnline: true,
          resort: { select: { name: true } },
        },
      },
    },
  });

  const out: BotInstructorPayload[] = [];
  for (const u of rows) {
    const p = u.instructorProfile;
    if (!p) continue;
    if (params.sport && !specializationMatches(p.specializations, params.sport)) continue;

    const avatar = resolveInstructorListAvatar({
      photoUrl: p.photoUrl,
      photoGallery: p.photoGallery,
      userImage: u.image,
    });

    out.push({
      id: u.id,
      name: u.name?.trim() || "Инструктор",
      sport: primarySport(p.specializations),
      photo_url: publicUploadAbsoluteDisplaySrc(avatar),
      profile_url: absoluteUrl(instructorPublicPath(u)),
      city: p.workDistrict?.trim() || p.resort?.name?.trim() || null,
      is_online: p.isOnline,
    });
    if (out.length >= params.limit) break;
  }
  return out;
}
