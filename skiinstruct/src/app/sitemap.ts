import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";
import { absoluteUrl, PUBLIC_SITEMAP_PAGES } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = PUBLIC_SITEMAP_PAGES.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: new Date(),
    changeFrequency: page.path === "/" || page.path === "/client" ? "daily" : "monthly",
    priority: page.path === "/" ? 1 : page.path === "/client" ? 0.9 : 0.6,
  }));

  let instructorEntries: MetadataRoute.Sitemap = [];
  try {
    const instructors = await prisma.user.findMany({
      where: {
        role: "INSTRUCTOR",
        instructorProfile: { is: { verificationStatus: "APPROVED" } },
      },
      select: {
        id: true,
        instructorProfile: { select: { updatedAt: true } },
      },
      take: 5000,
    });

    instructorEntries = instructors.map((row) => ({
      url: absoluteUrl(`/instructors/${row.id}/reviews`),
      lastModified: row.instructorProfile?.updatedAt ?? new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));
  } catch {
    instructorEntries = [];
  }

  return [...staticEntries, ...instructorEntries];
}
