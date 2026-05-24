import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const lat = 43.659;
const lng = 40.314;
const radiusKm = 5;
const includeOffline = false;
const ONLINE_DISCOVERY_RADIUS_KM = 100;
const skillLabel = "Средний";
const durationLabel = "День";
const languageNeedle = "русский";
const specialization = "🎾 Большой теннис";

function normalizeText(value) {
  return value
    .toLowerCase()
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const instructors = await prisma.user.findMany({
  where: {
    role: "INSTRUCTOR",
    instructorProfile: { verificationStatus: "APPROVED", isOnline: true },
  },
  include: { instructorProfile: true },
});

for (const u of instructors) {
  const p = u.instructorProfile;
  if (!p) continue;
  const pinLat = p.lat ?? lat;
  const pinLng = p.lng ?? lng;
  const km = haversineKm(lat, lng, pinLat, pinLng);
  const distanceOk =
    includeOffline || km <= radiusKm || (p.isOnline && km <= ONLINE_DISCOVERY_RADIUS_KM);
  const skillOk = !skillLabel || p.skillLevels.length === 0 || p.skillLevels.some((s) => s.trim() === skillLabel);
  const durOk =
    !durationLabel ||
    p.offeredDurations.length === 0 ||
    p.offeredDurations.some((d) => normalizeText(d) === normalizeText(durationLabel) || normalizeText(d).includes("день"));
  const langOk =
    !languageNeedle ||
    p.languages.length === 0 ||
    p.languages.some((lang) => normalizeText(lang) === languageNeedle);
  const specOk = p.specializations.some((s) => normalizeText(s).includes("теннис") || normalizeText(specialization).includes(normalizeText(s)));
  if (u.email === "instructor1@ya.ru") {
    console.log({
      name: u.name,
      km: Math.round(km * 10) / 10,
      distanceOk,
      skillOk,
      durOk,
      langOk,
      specOk,
      skillLevels: p.skillLevels,
      durations: p.offeredDurations,
    });
  }
}

await prisma.$disconnect();
