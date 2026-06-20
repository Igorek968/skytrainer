import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/instructor/login", "/instructor/apply"],
        disallow: [
          "/admin/",
          "/api/",
          "/client/orders",
          "/client/profile",
          "/client/messages",
          "/client/favorites",
          "/client/registrations",
          "/client/referral",
          "/instructor/orders",
          "/instructor/registrations",
          "/verify-email",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
