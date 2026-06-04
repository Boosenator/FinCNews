import { sanityAdmin } from "@/lib/sanity";
import { supabaseAdmin } from "@/lib/supabase";
import { BASE_URL } from "@/lib/config";

const MODEL = "claude-haiku-4-5-20251001";
const API_URL = "https://api.anthropic.com/v1/messages";

// ─── UTM helpers ──────────────────────────────────────────────────────────────

function withUtm(path: string, opts: {
  medium: "breaking" | "newsletter";
  campaign: string;
  content: string;
}): string {
  const url = new URL(path, BASE_URL);
  url.searchParams.set("utm_source", "email");
  url.searchParams.set("utm_medium", opts.medium);
  url.searchParams.set("utm_campaign", opts.campaign);
  url.searchParams.set("utm_content", opts.content);
  return url.toString();
}

function todayLabel(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function weekLabel(): string {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1);
  return `Week of ${start.toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}`;
}

// ─── Sanity fetch ─────────────────────────────────────────────────────────────

type SanityArticle = {
  _id: string;
  slug: string;
  category: string;
  publishedAt: string;
  en: { title: string; excerpt: string };
  tags?: string[];
};

async function fetchRecentArticles(hours = 48): Promise<SanityArticle[]> {
  if (!sanityAdmin) throw new Error("Sanity not configured");
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  return sanityAdmin.fetch<SanityArticle[]>(
    `*[_type == "article" && defined(translations.en.title) && publishedAt > $since]
     | order(publishedAt desc)[0...40] {
       _id,
       "slug": slug.current,
       category,
       publishedAt,
       tags,
       "en": translations.en { title, excerpt }
     }`,
    { since },
    { cache: "no-store" },
  );
}

// ─── Claude tool definition ───────────────────────────────────────────────────

const PLAN_TOOL = {
  name: "email_plan",
  description: "Output the email campaign plan",
  input_schema: {
    type: "object",
    properties: {
      breaking: {
        type: "array",
        description: "Articles that qualify for an immediate breaking alert (score >= 8). Empty array if none.",
        items: {
          type: "object",
          properties: {
            article_id:   { type: "string" },
            score:        { type: "number", description: "Breaking worthiness 1-10" },
            subject:      { type: "string", description: "Email subject line, max 60 chars" },
            preheader:    { type: "string", description: "Preview text, max 90 chars" },
            headline:     { type: "string", description: "Email headline (can differ slightly from title)" },
            excerpt:      { type: "string", description: "2-3 sentence email-optimised summary" },
            agent_notes:  { type: "string", description: "Why this qualifies as breaking" },
          },
          required: ["article_id", "score", "subject", "preheader", "headline", "excerpt", "agent_notes"],
        },
      },
      digest: {
        type: "object",
        description: "Weekly digest proposal. Null if fewer than 3 good articles.",
        nullable: true,
        properties: {
          subject:      { type: "string", description: "Digest email subject, max 65 chars" },
          preheader:    { type: "string", description: "Preview text, max 90 chars" },
          article_ids:  { type: "array", items: { type: "string" }, description: "5-7 article IDs ordered by importance" },
          agent_notes:  { type: "string" },
        },
        required: ["subject", "preheader", "article_ids", "agent_notes"],
      },
    },
    required: ["breaking", "digest"],
  },
};

// ─── Claude call ──────────────────────────────────────────────────────────────

type PlanResult = {
  breaking: Array<{
    article_id: string;
    score: number;
    subject: string;
    preheader: string;
    headline: string;
    excerpt: string;
    agent_notes: string;
  }>;
  digest: {
    subject: string;
    preheader: string;
    article_ids: string[];
    agent_notes: string;
  } | null;
};

async function callClaude(articles: SanityArticle[]): Promise<PlanResult> {
  const articleList = articles
    .map((a, i) =>
      `[${i + 1}] ID: ${a._id}
  Title: ${a.en.title}
  Excerpt: ${a.en.excerpt ?? "—"}
  Category: ${a.category}
  Published: ${new Date(a.publishedAt).toLocaleString("en")}
  Tags: ${a.tags?.join(", ") || "—"}`
    )
    .join("\n\n");

  const prompt = `You are the email newsletter editor for FinCNews — an AI-powered finance news service covering crypto, markets, macro, and fintech.

Review these ${articles.length} recent articles and create an email campaign plan.

ARTICLES:
${articleList}

BREAKING ALERT criteria (score 8-10 only):
- Major regulatory decision (SEC, Fed, government)
- Market move >5% for Bitcoin, ETH, S&P 500, or major individual asset
- Exchange hack, collapse, or insolvency
- Central bank rate decision
- Landmark legal ruling (crypto, financial regulation)
- Major company bankruptcy or acquisition in finance/crypto

Score 6-7 = significant but NOT breaking (include in digest only).
Score 1-5 = standard news (digest only if space allows).

DIGEST: Select the 5-7 most important articles regardless of breaking status. Order by significance.

Generate email-optimised copy: subjects should create urgency without clickbait, excerpts should be informative and drive to click.`;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      tools: [PLAN_TOOL],
      tool_choice: { type: "tool", name: "email_plan" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const toolUse = data.content?.find((b: { type: string }) => b.type === "tool_use");
  if (!toolUse) throw new Error("No tool_use in Claude response");
  return toolUse.input as PlanResult;
}

// ─── Main agent ───────────────────────────────────────────────────────────────

export type EmailPlannerResult = {
  articlesEvaluated: number;
  breakingDrafts: number;
  digestDrafts: number;
  skipped: string[];
};

export async function runEmailPlannerAgent(): Promise<EmailPlannerResult> {
  const db = supabaseAdmin();

  const articles = await fetchRecentArticles(48);
  if (articles.length === 0) {
    return { articlesEvaluated: 0, breakingDrafts: 0, digestDrafts: 0, skipped: [] };
  }

  const plan = await callClaude(articles);
  const byId = new Map(articles.map((a) => [a._id, a]));
  const today = todayLabel();
  const skipped: string[] = [];

  // ── Breaking drafts ──
  let breakingDrafts = 0;
  for (const b of plan.breaking) {
    const article = byId.get(b.article_id);
    if (!article) { skipped.push(b.article_id); continue; }

    const articleUrl = withUtm(`/${article.category}/${article.slug}`, {
      medium: "breaking",
      campaign: `fincnews-breaking-${today}`,
      content: article.slug,
    });

    await db.from("email_campaigns").insert({
      type: "breaking",
      status: "draft",
      subject: b.subject,
      preheader: b.preheader,
      headline: b.headline,
      excerpt: b.excerpt,
      article_slug: article.slug,
      article_url: articleUrl,
      articles: [],
      agent_notes: `Score: ${b.score}/10. ${b.agent_notes}`,
    });
    breakingDrafts++;
  }

  // ── Digest draft ──
  let digestDrafts = 0;
  if (plan.digest && plan.digest.article_ids.length >= 3) {
    const digestArticles = plan.digest.article_ids
      .map((id) => byId.get(id))
      .filter(Boolean) as SanityArticle[];

    const articlesJson = digestArticles.map((a) => ({
      headline: a.en.title,
      excerpt: a.en.excerpt ?? "",
      category: a.category,
      slug: a.slug,
      url: withUtm(`/${a.category}/${a.slug}`, {
        medium: "newsletter",
        campaign: `fincnews-digest-${today}`,
        content: a.slug,
      }),
    }));

    await db.from("email_campaigns").insert({
      type: "digest",
      status: "draft",
      subject: plan.digest.subject,
      preheader: plan.digest.preheader,
      headline: weekLabel(),
      excerpt: null,
      article_slug: null,
      article_url: null,
      articles: articlesJson,
      agent_notes: plan.digest.agent_notes,
    });
    digestDrafts++;
  }

  return {
    articlesEvaluated: articles.length,
    breakingDrafts,
    digestDrafts,
    skipped,
  };
}
