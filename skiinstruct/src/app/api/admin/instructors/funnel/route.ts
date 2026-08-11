import { NextResponse } from "next/server";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { instructorAnketaIsComplete } from "@/lib/instructor-anketa-status";
import { computeComplianceFlags } from "@/lib/instructor-compliance";
import {
  assignInstructorCrmStage,
  formatWaitingLabel,
  hoursSince,
  INSTRUCTOR_CRM_STAGES,
  isCrmStageOverdue,
  nextActionForInstructorCard,
  type InstructorCrmStage,
} from "@/lib/instructor-crm-funnel";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export type InstructorFunnelCard = {
  userId: string;
  name: string | null;
  email: string;
  phone: string | null;
  stage: InstructorCrmStage;
  stageEnteredAt: string;
  waitingHours: number;
  waitingLabel: string;
  overdue: boolean;
  verificationStatus: string;
  profileDraftStatus: string;
  isOnline: boolean;
  anketaComplete: boolean;
  canAcceptPaidOrders: boolean;
  pendingDocCount: number;
  payoutPending: boolean;
  yookassaNeedsOps: boolean;
  nextAction: string;
  flags: {
    agencyOfferAccepted: boolean;
    taxDocumentApproved: boolean;
    insuranceApproved: boolean;
    passportApproved: boolean;
  };
};

export type InstructorFunnelStageBucket = {
  id: InstructorCrmStage;
  label: string;
  shortLabel: string;
  slaHours: number | null;
  count: number;
  overdueCount: number;
  cards: InstructorFunnelCard[];
};

export type InstructorFunnelResponse = {
  generatedAt: string;
  totals: {
    instructors: number;
    overdue: number;
    moderation: number;
    docsIncomplete: number;
    docsReview: number;
    readyOffline: number;
    activeOnline: number;
    payoutPending: number;
  };
  stages: InstructorFunnelStageBucket[];
};

export async function GET() {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const now = new Date();

  const instructors = await prisma.user.findMany({
    where: { role: "INSTRUCTOR" },
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: {
      id: true,
      email: true,
      name: true,
      middleName: true,
      phone: true,
      birthDate: true,
      suspendedAt: true,
      createdAt: true,
      updatedAt: true,
      instructorProfile: {
        select: {
          isOnline: true,
          verificationStatus: true,
          profileDraftStatus: true,
          profileDraftSubmittedAt: true,
          agencyOfferAcceptedAt: true,
          taxStatus: true,
          inn: true,
          bio: true,
          passportSeries: true,
          passportNumber: true,
          passportIssuedAt: true,
          passportDepartmentCode: true,
          yookassaContractNotifiedAt: true,
          yookassaContractMarkedSentAt: true,
          updatedAt: true,
          createdAt: true,
        },
      },
      complianceDocuments: {
        select: {
          id: true,
          type: true,
          status: true,
          createdAt: true,
        },
      },
      payoutRequests: {
        where: { status: "PENDING" },
        select: { id: true, createdAt: true },
        take: 1,
      },
    },
  });

  const buckets = new Map<InstructorCrmStage, InstructorFunnelCard[]>();
  for (const meta of INSTRUCTOR_CRM_STAGES) {
    buckets.set(meta.id, []);
  }

  let payoutPendingTotal = 0;

  for (const u of instructors) {
    const p = u.instructorProfile;
    if (!p) continue;

    const approvedTypes = new Set(
      u.complianceDocuments.filter((d) => d.status === "APPROVED").map((d) => d.type),
    );
    const pendingDocs = u.complianceDocuments.filter((d) => d.status === "PENDING");
    const requiresPassport = Boolean(p.passportSeries && p.passportNumber);
    const flags = computeComplianceFlags({
      agencyOfferAcceptedAt: p.agencyOfferAcceptedAt,
      taxStatus: p.taxStatus,
      approvedDocTypes: approvedTypes,
      requiresPassportApproval: requiresPassport,
    });

    const anketaComplete = instructorAnketaIsComplete({
      name: u.name,
      middleName: u.middleName,
      phone: u.phone,
      email: u.email,
      birthDate: u.birthDate,
      inn: p.inn,
      taxStatus: p.taxStatus,
      passportSeries: p.passportSeries,
      passportNumber: p.passportNumber,
      passportIssuedAt: p.passportIssuedAt,
      passportDepartmentCode: p.passportDepartmentCode,
      bio: p.bio,
      hasPassportScan: u.complianceDocuments.some((d) => d.type === "PASSPORT"),
      hasTaxDocument: u.complianceDocuments.some(
        (d) => d.type === "TAX_STATUS_NPD" || d.type === "TAX_STATUS_IP",
      ),
    });

    const stage = assignInstructorCrmStage({
      suspendedAt: u.suspendedAt,
      verificationStatus: p.verificationStatus,
      profileDraftStatus: p.profileDraftStatus,
      canAcceptPaidOrders: flags.canAcceptPaidOrders,
      pendingDocCount: pendingDocs.length,
      isOnline: p.isOnline,
    });

    let stageEnteredAt: Date = p.updatedAt ?? u.updatedAt;
    if (stage === "moderation") {
      stageEnteredAt = p.profileDraftSubmittedAt ?? p.updatedAt ?? u.createdAt;
    } else if (stage === "docs_review" && pendingDocs.length) {
      stageEnteredAt = pendingDocs.reduce(
        (min, d) => (d.createdAt < min ? d.createdAt : min),
        pendingDocs[0]!.createdAt,
      );
    } else if (stage === "docs_incomplete") {
      stageEnteredAt = p.agencyOfferAcceptedAt ?? p.updatedAt ?? u.createdAt;
    } else if (stage === "rejected" || stage === "suspended") {
      stageEnteredAt = u.updatedAt;
    }

    const waitingHours = hoursSince(stageEnteredAt, now);
    const overdue = isCrmStageOverdue(stage, waitingHours);
    const payoutPending = u.payoutRequests.length > 0;
    if (payoutPending) payoutPendingTotal += 1;

    const yookassaNeedsOps = Boolean(
      p.agencyOfferAcceptedAt && !p.yookassaContractMarkedSentAt,
    );

    const nextAction = nextActionForInstructorCard({
      stage,
      anketaComplete,
      agencyOfferAccepted: flags.agencyOfferAccepted,
      taxDocumentApproved: flags.taxDocumentApproved,
      insuranceApproved: flags.insuranceApproved,
      passportApproved: flags.passportApproved,
      requiresPassport,
      pendingDocCount: pendingDocs.length,
      payoutPending,
      yookassaNeedsOps,
    });

    const card: InstructorFunnelCard = {
      userId: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      stage,
      stageEnteredAt: stageEnteredAt.toISOString(),
      waitingHours: Math.round(waitingHours * 10) / 10,
      waitingLabel: formatWaitingLabel(waitingHours),
      overdue,
      verificationStatus: p.verificationStatus,
      profileDraftStatus: p.profileDraftStatus,
      isOnline: p.isOnline,
      anketaComplete,
      canAcceptPaidOrders: flags.canAcceptPaidOrders,
      pendingDocCount: pendingDocs.length,
      payoutPending,
      yookassaNeedsOps,
      nextAction,
      flags: {
        agencyOfferAccepted: flags.agencyOfferAccepted,
        taxDocumentApproved: flags.taxDocumentApproved,
        insuranceApproved: flags.insuranceApproved,
        passportApproved: flags.passportApproved,
      },
    };

    buckets.get(stage)!.push(card);
  }

  // Overdue first, then longest wait
  for (const list of buckets.values()) {
    list.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return b.waitingHours - a.waitingHours;
    });
  }

  const stages: InstructorFunnelStageBucket[] = INSTRUCTOR_CRM_STAGES.map((meta) => {
    const cards = buckets.get(meta.id) ?? [];
    return {
      id: meta.id,
      label: meta.label,
      shortLabel: meta.shortLabel,
      slaHours: meta.slaHours,
      count: cards.length,
      overdueCount: cards.filter((c) => c.overdue).length,
      cards,
    };
  });

  const byId = (id: InstructorCrmStage) => stages.find((s) => s.id === id)?.count ?? 0;
  const overdue = stages.reduce((sum, s) => sum + s.overdueCount, 0);

  const body: InstructorFunnelResponse = {
    generatedAt: now.toISOString(),
    totals: {
      instructors: instructors.filter((u) => u.instructorProfile).length,
      overdue,
      moderation: byId("moderation"),
      docsIncomplete: byId("docs_incomplete"),
      docsReview: byId("docs_review"),
      readyOffline: byId("ready_offline"),
      activeOnline: byId("active_online"),
      payoutPending: payoutPendingTotal,
    },
    stages,
  };

  return NextResponse.json(body);
}
