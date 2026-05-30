import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { runEditorialAgent, TOPIC_HUB_PLANS } from "@/lib/editorial-agent";
import { sanityAdmin } from "@/lib/sanity";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = sanityAdmin
    ? await sanityAdmin.fetch<Array<{ slug: string; title: string; updatedAt?: string }>>(
        `*[_type == "topicHub" && defined(slug.current)] {
          "slug": slug.current,
          title,
          updatedAt
        }`,
        {},
      )
    : [];
  const existingBySlug = new Map(existing.map((hub) => [hub.slug, hub]));

  const topics = await Promise.all(
    TOPIC_HUB_PLANS.map(async (plan) => {
      const pattern = plan.keywords.map((kw) => `${kw}*`).join(" ");
      const relatedCount = sanityAdmin
        ? await sanityAdmin.fetch<number>(
            `count(*[_type == "article" && defined(translations.en.title) && (
              translations.en.title match $pattern ||
              translations.en.excerpt match $pattern ||
              tags[] match $pattern
            )])`,
            { pattern },
          )
        : 0;
      const hub = existingBySlug.get(plan.slug);
      return {
        ...plan,
        status: hub ? "published" : "planned",
        updatedAt: hub?.updatedAt ?? null,
        currentTitle: hub?.title ?? null,
        relatedCount,
        url: hub ? `/topics/${plan.slug}` : null,
      };
    }),
  );

  return NextResponse.json({ topics });
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { slug?: string };
  const result = await runEditorialAgent(body.slug);
  return NextResponse.json({ ok: true, ...result });
}
