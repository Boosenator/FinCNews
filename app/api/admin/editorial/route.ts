import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { runEditorialAgent, TOPIC_HUB_PLANS } from "@/lib/editorial-agent";
import { sanityAdmin } from "@/lib/sanity";
import { buildTopicArticleFilter } from "@/lib/topic-matching";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = sanityAdmin
    ? await sanityAdmin.fetch<Array<{ _id: string; slug: string; title: string; updatedAt?: string }>>(
        `*[_type == "topicHub" && defined(slug.current)] {
          _id,
          "slug": slug.current,
          title,
          updatedAt
        }`,
        {},
      )
    : [];
  const publicBySlug = new Map(existing.filter((hub) => !hub._id.includes(".")).map((hub) => [hub.slug, hub]));
  const privateBySlug = new Map(existing.filter((hub) => hub._id.includes(".")).map((hub) => [hub.slug, hub]));

  const topics = await Promise.all(
    TOPIC_HUB_PLANS.map(async (plan) => {
      const { filter, params } = buildTopicArticleFilter(plan.keywords);
      const relatedCount = sanityAdmin
        ? await sanityAdmin.fetch<number>(
            `count(*[_type == "article" && defined(translations.en.title) && (${filter})])`,
            params,
          )
        : 0;
      const hub = publicBySlug.get(plan.slug);
      const privateHub = privateBySlug.get(plan.slug);
      return {
        ...plan,
        status: hub ? "published" : privateHub ? "private" : "planned",
        updatedAt: hub?.updatedAt ?? privateHub?.updatedAt ?? null,
        currentTitle: hub?.title ?? privateHub?.title ?? null,
        relatedCount,
        url: hub ? `/topics/${plan.slug}` : null,
      };
    }),
  );

  return NextResponse.json({ topics });
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as { slug?: string };
    const result = await runEditorialAgent(body.slug);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
