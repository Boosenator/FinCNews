import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { BASE_URL } from "@/lib/config";
import { isProductionHost } from "@/lib/seo-host";

export default function robots(): MetadataRoute.Robots {
  if (!isProductionHost(headers().get("host"))) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/flows", "/studio/"],
      },
    ],
    sitemap: [
      `${BASE_URL}/sitemap.xml`,
      `${BASE_URL}/news-sitemap.xml`,
    ],
  };
}
