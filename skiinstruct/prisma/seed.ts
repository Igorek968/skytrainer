import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

import { seedDemoInstructors } from "./seed-instructors";

const prisma = new PrismaClient();

async function main() {
  await prisma.message.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.instructorProfile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.resort.deleteMany();

  const resorts = await prisma.$transaction([
    prisma.resort.create({
      data: {
        name: "Роза Хутор",
        slug: "rosa-khutor",
        country: "Россия",
        centerLat: 43.659,
        centerLng: 40.314,
        zoom: 13,
      },
    }),
    prisma.resort.create({
      data: {
        name: "Горки Город",
        slug: "gorki-gorod",
        country: "Россия",
        centerLat: 43.682,
        centerLng: 40.265,
        zoom: 13,
      },
    }),
  ]);

  const pass = await hash("Password123!", 12);

  const client = await prisma.user.create({
    data: {
      email: "client@example.com",
      phone: "79000000001",
      name: "Тест Клиент",
      passwordHash: pass,
      role: "CLIENT",
    },
  });

  const inst1User = await prisma.user.create({
    data: {
      email: "instructor1@example.com",
      name: "Алексей Инструктор",
      passwordHash: pass,
      role: "INSTRUCTOR",
    },
  });

  const inst2User = await prisma.user.create({
    data: {
      email: "instructor2@example.com",
      name: "Мария Про",
      passwordHash: pass,
      role: "INSTRUCTOR",
    },
  });

  await prisma.instructorProfile.create({
    data: {
      userId: inst1User.id,
      bio: "Сертификат ISIA, 8 лет на склоне.",
      certificationLevel: "ISIA Level 2",
      languages: ["Русский", "English"],
      hourlyRate: 3500,
      lat: 43.6595,
      lng: 40.3145,
      isOnline: true,
      verificationStatus: "APPROVED",
      specializations: ["Горные лыжи", "Карвинг"],
      resortId: resorts[0].id,
      ratingAvg: 4.8,
      reviewCount: 12,
    },
  });

  await prisma.instructorProfile.create({
    data: {
      userId: inst2User.id,
      bio: "Фрирайд и детские группы.",
      certificationLevel: "РГИ",
      languages: ["Русский"],
      hourlyRate: 2800,
      lat: 43.6601,
      lng: 40.3155,
      isOnline: true,
      verificationStatus: "APPROVED",
      specializations: ["Сноуборд"],
      resortId: resorts[0].id,
      ratingAvg: 4.5,
      reviewCount: 7,
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: "admin@example.com",
      name: "Админ",
      passwordHash: pass,
      role: "ADMIN",
    },
  });

  // Pending instructor for moderation demo
  const pendingUser = await prisma.user.create({
    data: {
      email: "pending@example.com",
      name: "Новый Инструктор",
      passwordHash: pass,
      role: "INSTRUCTOR",
    },
  });

  await prisma.instructorProfile.create({
    data: {
      userId: pendingUser.id,
      bio: "На модерации",
      certificationLevel: "—",
      languages: ["Русский"],
      hourlyRate: 2000,
      lat: 43.658,
      lng: 40.31,
      isOnline: false,
      verificationStatus: "PENDING",
      specializations: ["Лыжи"],
      resortId: resorts[1].id,
    },
  });

  await seedDemoInstructors(prisma);

  console.log("Seed OK", {
    client: `${client.email} (пароль Password123!)`,
    admin: admin.email,
    resorts: resorts.length,
    demoInstructors: "demo-skier-01@example.com … (инструкторы) — вход /instructor/login, пароль Password123!",
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
