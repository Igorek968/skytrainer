import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";
import { publicEventPath } from "@/lib/public-event";
import { absoluteUrl, landingSitemapPages, PUBLIC_SITEMAP_PAGES } from "@/lib/seo";
import { activePublishedEventWhere } from "@/lib/services/instructor-event-expiry";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = PUBLIC_SITEMAP_PAGES.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: new Date(),
    changeFrequency: page.path === "/" ? "daily" : "monthly",
    priority: page.path === "/" ? 1 : page.path.startsWith("/instructor/apply") ? 0.7 : 0.5,
  }));

  const landingEntries: MetadataRoute.Sitemap = landingSitemapPages().map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: page.path.split("/").length <= 3 ? 0.8 : 0.7,
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

    instructorEntries = instructors.flatMap((row) => {
      const lastModified = row.instructorProfile?.updatedAt ?? new Date();
      return [
        {
          url: absoluteUrl(`/instructors/${row.id}`),
          lastModified,
          changeFrequency: "weekly" as const,
          priority: 0.6,
        },
        {
          url: absoluteUrl(`/instructors/${row.id}/reviews`),
          lastModified,
          changeFrequency: "weekly" as const,
          priority: 0.4,
        },
      ];
    });
  } catch {
    instructorEntries = [];
  }

  let eventEntries: MetadataRoute.Sitemap = [];
  try {
    const events = await prisma.instructorEvent.findMany({
      where: { ...activePublishedEventWhere(), orderId: null },
      select: { id: true, updatedAt: true },
      take: 2000,
    });
    eventEntries = events.map((row) => ({
      url: absoluteUrl(publicEventPath(row.id)),
      lastModified: row.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));
  } catch {
    eventEntries = [];
  }

  return [
    ...staticEntries,
    ...landingEntries,
    {
      url: absoluteUrl("/events"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...instructorEntries,
    ...eventEntries,
  ];
}
