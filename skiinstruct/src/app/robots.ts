import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/gorod/", "/sport/", "/instructors/", "/instructor/login", "/instructor/apply"],
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
          "/instructor/profile",
          "/instructor/availability",
          "/verify-email",
          "/login",
          "/register",
          "/reset-password",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/").replace(/\/$/, ""),
  };
}
