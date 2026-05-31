import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import {
  approveTopicSuggestion,
  dismissTopicSuggestion,
  getTopicHubPlans,
  getTopicSuggestions,
  runEditorialAgent,
  runTopicDiscoveryAgent,
} from "@/lib/editorial-agent";
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

  const plans = await getTopicHubPlans();
  const topics = await Promise.all(
    plans.map(async (plan) => {
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

  const suggestions = await getTopicSuggestions();
  return NextResponse.json({ topics, suggestions });
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: "refresh" | "discover" | "approve-suggestion" | "dismiss-suggestion" | "create-suggestion";
      slug?: string;
    };
    if (body.action === "discover") {
      const result = await runTopicDiscoveryAgent();
      return NextResponse.json({ ok: true, action: "discover", ...result });
    }
    if (body.action === "approve-suggestion") {
      if (!body.slug) throw new Error("Missing suggestion slug");
      const plan = await approveTopicSuggestion(body.slug);
      return NextResponse.json({ ok: true, action: "approve-suggestion", plan });
    }
    if (body.action === "dismiss-suggestion") {
      if (!body.slug) throw new Error("Missing suggestion slug");
      const result = await dismissTopicSuggestion(body.slug);
      return NextResponse.json({ ok: true, action: "dismiss-suggestion", ...result });
    }
    if (body.action === "create-suggestion") {
      if (!body.slug) throw new Error("Missing suggestion slug");
      await approveTopicSuggestion(body.slug);
      const result = await runEditorialAgent(body.slug);
      return NextResponse.json({ ok: true, action: "create-suggestion", ...result });
    }

    const result = await runEditorialAgent(body.slug);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
