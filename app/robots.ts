import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fin-c-news.vercel.app";

export default function robots(): MetadataRoute.Robots {
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
