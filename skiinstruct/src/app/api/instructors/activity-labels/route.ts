import { NextResponse } from "next/server";

import { liveInstructorEmailWhere } from "@/lib/demo-instructor";
import { prisma } from "@/lib/prisma";
import { mergeActivityLabelsForClientSearch } from "@/lib/services/instructor-match";

export const dynamic = "force-dynamic";

export async function GET() {
  const profiles = await prisma.instructorProfile.findMany({
    where: {
      verificationStatus: "APPROVED",
      user: {
        role: "INSTRUCTOR",
        ...liveInstructorEmailWhere,
      },
    },
    select: {
      specializations: true,
      specializationOffers: true,
    },
  });

  const extraLabels: string[] = [];
  for (const profile of profiles) {
    extraLabels.push(...profile.specializations);
    if (!Array.isArray(profile.specializationOffers)) continue;
    for (const row of profile.specializationOffers) {
      if (!row || typeof row !== "object") continue;
      const label = (row as { label?: unknown }).label;
      if (typeof label === "string" && label.trim()) extraLabels.push(label.trim());
    }
  }

  return NextResponse.json(
    { labels: mergeActivityLabelsForClientSearch(extraLabels) },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
