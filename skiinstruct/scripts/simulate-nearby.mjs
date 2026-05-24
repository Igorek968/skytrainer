import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const lat = 43.659;
const lng = 40.314;
const radiusKm = 5;

const valera = await prisma.user.findFirst({
  where: { email: "instructor1@ya.ru" },
  include: { instructorProfile: true },
});
const p = valera.instructorProfile;
const km = haversine(lat, lng, p.lat, p.lng);
console.log("Valera distance km:", Math.round(km * 10) / 10);
console.log("Passes 5km:", km <= 5);
console.log("Passes 20km (online*4):", km <= 20);
console.log("Has День duration:", p.offeredDurations);
console.log("Slots days:", p.availabilitySlots?.map((s) => s.day));

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

await prisma.$disconnect();
