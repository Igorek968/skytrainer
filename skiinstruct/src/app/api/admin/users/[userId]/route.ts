import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { writeAdminAudit } from "@/lib/services/admin-audit";
import { adminDeleteUser } from "@/lib/services/admin-delete-user";

type Ctx = { params: Promise<{ userId: string }> };

const patchSchema = z.object({
  name: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(32).optional().nullable(),
  email: z.string().trim().email().max(200).optional(),
  suspended: z.boolean().optional(),
  suspendedNote: z.string().trim().max(2000).optional().nullable(),
  forceOffline: z.boolean().optional(),
  certificationLevel: z.enum(["A", "B", "C", "D"]).optional().nullable(),
  experienceYears: z.number().int().min(0).max(80).optional().nullable(),
  sportsExperienceYears: z.number().int().min(0).max(80).optional().nullable(),
  age: z.number().int().min(14).max(100).optional().nullable(),
  bio: z.string().trim().max(4000).optional().nullable(),
  hourlyRate: z.number().min(0).max(500_000).optional(),
});

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const { userId } = await ctx.params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      middleName: true,
      nickname: true,
      phone: true,
      birthDate: true,
      role: true,
      suspendedAt: true,
      suspendedNote: true,
      createdAt: true,
      updatedAt: true,
      instructorProfile: {
        select: {
          isOnline: true,
          verificationStatus: true,
          certificationLevel: true,
          experienceYears: true,
          sportsExperienceYears: true,
          age: true,
          bio: true,
          hourlyRate: true,
          specializations: true,
          payoutAccountHint: true,
          inn: true,
          taxStatus: true,
          agencyOfferAcceptedAt: true,
          agencyOfferVersion: true,
          passportSeries: true,
          passportNumber: true,
          passportIssuedAt: true,
          passportDepartmentCode: true,
        },
      },
      complianceDocuments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          status: true,
          fileUrl: true,
          rejectNote: true,
          createdAt: true,
        },
      },
    },
  });
  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const { resolveSensitiveUploadDisplaySrc } = await import("@/lib/sensitive-upload-urls");
  const { complianceDocTypeLabel } = await import("@/lib/instructor-agency-registry");
  const { instructorAnketaMissingFields } = await import("@/lib/instructor-anketa-status");
  const { readSensitiveUpload } = await import("@/lib/private-uploads");

  const p = user.instructorProfile;
  const docs = user.complianceDocuments;
  const missingFields = p
    ? instructorAnketaMissingFields({
        name: user.name,
        middleName: user.middleName,
        phone: user.phone,
        email: user.email,
        birthDate: user.birthDate,
        inn: p.inn,
        taxStatus: p.taxStatus,
        passportSeries: p.passportSeries,
        passportNumber: p.passportNumber,
        passportIssuedAt: p.passportIssuedAt,
        passportDepartmentCode: p.passportDepartmentCode,
        bio: p.bio,
        hasPassportScan: docs.some((d) => d.type === "PASSPORT"),
        hasTaxDocument: docs.some((d) => d.type === "TAX_STATUS_NPD" || d.type === "TAX_STATUS_IP"),
      })
    : [];

  const documents = await Promise.all(
    docs.map(async (d) => {
      const viewUrl = resolveSensitiveUploadDisplaySrc(d.fileUrl);
      let fileMissing = false;
      if (viewUrl?.startsWith("/api/private-media/")) {
        const segments = viewUrl.slice("/api/private-media/".length).split("/").filter(Boolean);
        const buf = await readSensitiveUpload(segments);
        fileMissing = !buf;
      } else if (!viewUrl) {
        fileMissing = true;
      }
      return {
        id: d.id,
        type: d.type,
        typeLabel: complianceDocTypeLabel(d.type),
        status: d.status,
        rejectNote: d.rejectNote,
        createdAt: d.createdAt.toISOString(),
        viewUrl: fileMissing ? null : viewUrl,
        fileMissing,
      };
    }),
  );

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      middleName: user.middleName,
      nickname: user.nickname,
      phone: user.phone,
      birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null,
      role: user.role,
      suspendedAt: user.suspendedAt?.toISOString() ?? null,
      suspendedNote: user.suspendedNote,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      anketaComplete: missingFields.length === 0,
      missingFields,
      instructorProfile: p
        ? {
            isOnline: p.isOnline,
            verificationStatus: p.verificationStatus,
            certificationLevel: p.certificationLevel,
            experienceYears: p.experienceYears,
            sportsExperienceYears: p.sportsExperienceYears,
            age: p.age,
            bio: p.bio,
            hourlyRate: Number(p.hourlyRate),
            specializations: p.specializations,
            payoutAccountHint: p.payoutAccountHint,
            inn: p.inn,
            taxStatus: p.taxStatus,
            agencyOfferAcceptedAt: p.agencyOfferAcceptedAt?.toISOString() ?? null,
            agencyOfferVersion: p.agencyOfferVersion,
            passportSeries: p.passportSeries,
            passportNumber: p.passportNumber,
            passportIssuedAt: p.passportIssuedAt?.toISOString().slice(0, 10) ?? null,
            passportDepartmentCode: p.passportDepartmentCode,
          }
        : null,
      documents,
    },
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const { userId } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { instructorProfile: { select: { userId: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  if (userId === auth.userId && parsed.data.suspended === true) {
    return NextResponse.json({ error: "Нельзя заблокировать самого себя" }, { status: 400 });
  }

  const data = parsed.data;
  if (data.email && data.email !== existing.email) {
    const clash = await prisma.user.findFirst({
      where: { email: data.email, NOT: { id: userId } },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json({ error: "Email уже занят" }, { status: 400 });
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined ? { name: data.name?.trim() || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.suspended === true
        ? {
            suspendedAt: new Date(),
            suspendedNote: data.suspendedNote?.trim() || existing.suspendedNote,
          }
        : {}),
      ...(data.suspended === false
        ? { suspendedAt: null, suspendedNote: data.suspendedNote?.trim() || null }
        : {}),
      ...(data.suspended === undefined && data.suspendedNote !== undefined
        ? { suspendedNote: data.suspendedNote?.trim() || null }
        : {}),
    },
  });

  const profilePatch = {
    ...(data.forceOffline === true || data.suspended === true ? { isOnline: false } : {}),
    ...(data.certificationLevel !== undefined
      ? { certificationLevel: data.certificationLevel }
      : {}),
    ...(data.experienceYears !== undefined ? { experienceYears: data.experienceYears } : {}),
    ...(data.sportsExperienceYears !== undefined
      ? { sportsExperienceYears: data.sportsExperienceYears }
      : {}),
    ...(data.age !== undefined ? { age: data.age } : {}),
    ...(data.bio !== undefined ? { bio: data.bio?.trim() || null } : {}),
    ...(data.hourlyRate !== undefined ? { hourlyRate: data.hourlyRate } : {}),
  };

  if (existing.instructorProfile && Object.keys(profilePatch).length > 0) {
    await prisma.instructorProfile.update({
      where: { userId },
      data: profilePatch,
    });
  } else if (data.forceOffline === true && !existing.instructorProfile) {
    /* no-op */
  }

  await writeAdminAudit({
    actorId: auth.userId,
    action: "user.update",
    entity: "User",
    entityId: userId,
    summary: [
      data.suspended === true ? "блокировка" : null,
      data.suspended === false ? "разблокировка" : null,
      data.forceOffline ? "офлайн" : null,
      data.name !== undefined || data.email !== undefined || data.phone !== undefined
        ? "профиль"
        : null,
    ]
      .filter(Boolean)
      .join(", ") || "обновление пользователя",
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const { userId } = await ctx.params;
  const result = await adminDeleteUser({
    targetUserId: userId,
    actorUserId: auth.userId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await writeAdminAudit({
    actorId: auth.userId,
    action: "user.delete",
    entity: "User",
    entityId: userId,
    summary: `Удалён пользователь ${result.email}`,
  });

  return NextResponse.json({
    ok: true,
    email: result.email,
    role: result.role,
  });
}
