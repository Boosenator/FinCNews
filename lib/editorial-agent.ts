import { createClient } from "@sanity/client";
import { sanityAdmin, type PortableTextBlock } from "@/lib/sanity";
import { buildTopicArticleFilter } from "@/lib/topic-matching";
import { supabaseAdmin } from "@/lib/supabase";
import { callClaude, parseClaudeJson } from "@/lib/personas/shared";

export type TopicPlan = {
  slug: string;
  title: string;
  keywords: string[];
};

type GeneratedHub = {
  title: string;
  description: string;
  body: string;
  faqs: Array<{ question: string; answer: string }>;
};

type RelatedArticleInput = {
  title: string;
  excerpt?: string;
  slug: string;
  category: string;
  publishedAt?: string;
};

type DiscoveryArticleInput = RelatedArticleInput & {
  tags?: string[];
};

export type TopicSuggestion = TopicPlan & {
  reason: string;
  relatedArticleCount: number;
  priority: "high" | "medium" | "low";
  status: "suggested" | "approved" | "dismissed";
  discoveredAt?: string;
};

type DiscoveryResult = {
  suggestions: Array<{
    title: string;
    slug: string;
    keywords: string[];
    reason: string;
    relatedArticleCount?: number;
    priority: "high" | "medium" | "low";
    shouldCreateHub: boolean;
  }>;
};

export const STATIC_TOPIC_HUB_PLANS: TopicPlan[] = [
  { slug: "bitcoin", title: "Bitcoin", keywords: ["bitcoin", "btc", "spot bitcoin etf", "bitcoin treasury"] },
  { slug: "ethereum", title: "Ethereum", keywords: ["ethereum", "eth", "staking", "layer 2"] },
  { slug: "crypto-etfs", title: "Crypto ETFs", keywords: ["bitcoin etf", "ethereum etf", "spot etf", "etf inflows"] },
  { slug: "sec-crypto", title: "SEC Crypto Regulation", keywords: ["sec", "crypto regulation", "broker dealer", "tokenized stocks"] },
  { slug: "federal-reserve", title: "Federal Reserve Policy", keywords: ["fed", "federal reserve", "rate cut", "rate hike", "cpi"] },
  { slug: "stablecoins", title: "Stablecoins", keywords: ["stablecoin", "usdc", "tether", "cbdc", "payments"] },
  { slug: "xrp", title: "XRP", keywords: ["xrp", "ripple", "xrpl", "xrp etf"] },
  { slug: "solana", title: "Solana", keywords: ["solana", "sol", "solana defi", "solana etf"] },
];

export const TOPIC_HUB_PLANS = STATIC_TOPIC_HUB_PLANS;

// ── Persona assignment for topic hubs ─────────────────────────────────────────

const TOPIC_PERSONA_MAP: Record<string, string> = {
  'bitcoin':          'marcus-webb',
  'ethereum':         'marcus-webb',
  'crypto-etfs':      'elena-voss',
  'sec-crypto':       'elena-voss',
  'federal-reserve':  'elena-voss',
  'stablecoins':      'elena-voss',
  'xrp':              'leo-cruz',
  'solana':           'leo-cruz',
};

function getPersonaForTopic(slug: string): string {
  return TOPIC_PERSONA_MAP[slug] ?? 'marcus-webb';
}

const PERSONA_HUB_VOICE: Record<string, string> = {
  'marcus-webb': `You are Marcus Webb, FinCNews on-chain analyst and senior markets editor.
You write about Bitcoin, Ethereum, DeFi, and blockchain infrastructure with data-driven precision.
Your voice: analytical, number-grounded, institutional. You explain what on-chain metrics mean for investors — not just what they are.
When writing a topic hub, establish authority through technical depth and market structure analysis.
Avoid hype. Find the signal. Explain why capital allocation decisions matter.`,

  'elena-voss': `You are Elena Voss, FinCNews macro and policy correspondent.
You cover the intersection of traditional finance and digital assets: Federal Reserve policy, SEC regulation, ETF flows, stablecoin legislation, and institutional infrastructure.
Your voice: measured, policy-aware, and structurally analytical. A senior portfolio manager should find your hub credible.
When writing a topic hub, focus on regulatory trajectory, institutional behavior, and macro context.
No speculation. Only what the evidence supports.`,

  'leo-cruz': `You are Leo Cruz, FinCNews markets and narrative editor.
You track XRP, Solana, trending tokens, and the narrative cycles that drive trading activity and retail sentiment.
Your voice: energetic but grounded — you call out hype when you see it, but you spot genuine momentum.
When writing a topic hub, explain not just what the asset does, but why investors are paying attention now and what structural developments matter.
Balance narrative energy with factual grounding.`,
};

export type EditorialAgentResult = {
  slug: string;
  title: string;
  relatedArticles: number;
  sanityId: string;
  personaId?: string;
  victorDecision?: 'approve' | 'edit' | 'block';
  victorFeedback?: string;
};

type HotTopic = TopicPlan & {
  score: number;
  recent24h: number;
  recent72h: number;
};

type DailyHotTopicPlan = {
  _id: string;
  _type: "editorialHotPlan";
  date: string;
  selectedAt: string;
  topics: HotTopic[];
};

export type ScheduledEditorialAgentResult = EditorialAgentResult & {
  slot: "morning" | "evening";
  hotPlanDate: string;
  hotScore: number;
  recent24h: number;
  recent72h: number;
};

export async function runEditorialAgent(slug?: string): Promise<EditorialAgentResult> {
  if (!sanityAdmin) throw new Error("Sanity is not configured");
  if (!process.env.SANITY_TOKEN) throw new Error("SANITY_TOKEN is not configured");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

  const plans = await getTopicHubPlans();
  const plan = slug
    ? plans.find((item) => item.slug === slug)
    : await pickNextTopicHub();
  if (!plan) throw new Error(`Unknown topic hub: ${slug}`);

  const personaId = getPersonaForTopic(plan.slug);
  const [related, coverageContext] = await Promise.all([
    fetchRelatedArticleInputs(plan),
    fetchCoverageLogContext(plan),
  ]);

  const generated = await generateHub(plan, related, personaId, coverageContext);
  const victorReview = await reviewHubWithVictor(plan, generated, personaId);

  if (victorReview.decision === 'block') {
    throw new Error(`Victor Kane blocked hub "${plan.title}": ${victorReview.feedback}`);
  }

  const sanity = createClient({
    projectId: process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.SANITY_DATASET ?? "production",
    token: process.env.SANITY_TOKEN!,
    apiVersion: "2024-01-01",
    useCdn: false,
  });

  const doc = await sanity.createOrReplace({
    _id: `topicHub-${plan.slug}`,
    _type: "topicHub",
    slug: { _type: "slug", current: plan.slug },
    title: generated.title,
    description: generated.description,
    updatedAt: new Date().toISOString(),
    keywords: plan.keywords,
    body: normalizeBody(generated.body, related),
    faqs: generated.faqs,
  });

  await logHubContribution(plan, personaId, generated, victorReview);

  return {
    slug: plan.slug,
    title: generated.title,
    relatedArticles: related.length,
    sanityId: doc._id,
    personaId,
    victorDecision: victorReview.decision,
    victorFeedback: victorReview.feedback,
  };
}

export async function runScheduledEditorialAgent(slot: "morning" | "evening"): Promise<ScheduledEditorialAgentResult> {
  const dailyPlan = await getOrCreateDailyHotTopicPlan();
  const topicIndex = slot === "morning" ? 0 : 1;
  const selected = dailyPlan.topics[topicIndex] ?? dailyPlan.topics[0];
  if (!selected) throw new Error("No hot topics available for editorial schedule");

  const result = await runEditorialAgent(selected.slug);
  return {
    ...result,
    slot,
    hotPlanDate: dailyPlan.date,
    hotScore: selected.score,
    recent24h: selected.recent24h,
    recent72h: selected.recent72h,
  };
}

export async function getTopicHubPlans(): Promise<TopicPlan[]> {
  if (!sanityAdmin) return STATIC_TOPIC_HUB_PLANS;
  const dynamic = await sanityAdmin.fetch<TopicPlan[]>(
    `*[_type == "editorialTopicPlan" && status == "approved" && defined(slug.current)]
     | order(title asc) {
      "slug": slug.current,
      title,
      keywords
    }`,
    {},
  );
  const bySlug = new Map(STATIC_TOPIC_HUB_PLANS.map((plan) => [plan.slug, plan]));
  for (const plan of dynamic ?? []) {
    if (plan.slug && plan.title && Array.isArray(plan.keywords) && plan.keywords.length > 0) {
      bySlug.set(plan.slug, plan);
    }
  }
  return Array.from(bySlug.values());
}

export type CoverageRefreshItem = {
  slug: string;
  title: string;
  personaId: string;
  newArticleCount: number;
  lastUpdated: string | null;
};

export async function checkCoverageRefreshNeeded(minArticles = 3): Promise<CoverageRefreshItem[]> {
  try {
    const plans = await getTopicHubPlans();
    if (!sanityAdmin) return [];

    const db = supabaseAdmin();
    const hubs = await sanityAdmin.fetch<Array<{ slug: string; updatedAt?: string }>>(
      `*[_type == "topicHub" && defined(slug.current)] { "slug": slug.current, updatedAt }`,
      {},
    );
    const hubMap = new Map(hubs.map(h => [h.slug, h.updatedAt ?? null]));
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const results = await Promise.all(plans.map(async (plan) => {
      const lastUpdated = hubMap.get(plan.slug) ?? null;
      const cutoff = lastUpdated
        ? new Date(Math.max(new Date(lastUpdated).getTime(), weekAgo)).toISOString()
        : new Date(weekAgo).toISOString();

      const orFilter = plan.keywords.slice(0, 4).map(k => `title.ilike.%${k}%`).join(',');
      const { count } = await db
        .from('coverage_log')
        .select('id', { count: 'exact', head: true })
        .or(orFilter)
        .gte('created_at', cutoff);

      return {
        slug: plan.slug,
        title: plan.title,
        personaId: getPersonaForTopic(plan.slug),
        newArticleCount: count ?? 0,
        lastUpdated,
      };
    }));

    return results.filter(r => r.newArticleCount >= minArticles);
  } catch {
    return [];
  }
}

export async function runTopicDiscoveryAgent(): Promise<{ suggestions: TopicSuggestion[]; analyzedArticles: number }> {
  if (!sanityAdmin) throw new Error("Sanity is not configured");
  if (!process.env.SANITY_TOKEN) throw new Error("SANITY_TOKEN is not configured");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

  const existingPlans = await getTopicHubPlans();
  const articles = await fetchRecentDiscoveryArticles();
  if (articles.length < 3) return { suggestions: [], analyzedArticles: articles.length };

  const discovered = await discoverTopicSuggestions(articles, existingPlans);
  const existingSlugs = new Set(existingPlans.map((plan) => plan.slug));
  const saved: TopicSuggestion[] = [];

  const sanity = createClient({
    projectId: process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.SANITY_DATASET ?? "production",
    token: process.env.SANITY_TOKEN!,
    apiVersion: "2024-01-01",
    useCdn: false,
  });

  for (const item of discovered.suggestions) {
    const slug = normalizeSlug(item.slug || item.title);
    if (!slug || existingSlugs.has(slug) || item.shouldCreateHub === false) continue;
    const keywords = normalizeKeywords(item.keywords, item.title);
    if (keywords.length < 2) continue;

    const relatedArticleCount = await countRelatedArticlesForKeywords(keywords);
    if (relatedArticleCount < 3) continue;

    const doc = await sanity.createOrReplace({
      _id: `editorialTopicSuggestion-${slug}`,
      _type: "editorialTopicSuggestion",
      slug: { _type: "slug", current: slug },
      title: item.title,
      keywords,
      reason: item.reason,
      relatedArticleCount,
      priority: item.priority,
      status: "suggested",
      discoveredAt: new Date().toISOString(),
      analysisWindowHours: 72,
    });
    saved.push({
      slug,
      title: doc.title,
      keywords: doc.keywords,
      reason: doc.reason,
      relatedArticleCount: doc.relatedArticleCount,
      priority: item.priority,
      status: "suggested",
      discoveredAt: doc.discoveredAt,
    });
  }

  return { suggestions: saved, analyzedArticles: articles.length };
}

export async function getTopicSuggestions(): Promise<TopicSuggestion[]> {
  if (!sanityAdmin) return [];
  return sanityAdmin.fetch<TopicSuggestion[]>(
    `*[_type == "editorialTopicSuggestion" && status == "suggested" && defined(slug.current)]
     | order(priority asc, relatedArticleCount desc, discoveredAt desc)[0...20] {
      "slug": slug.current,
      title,
      keywords,
      reason,
      relatedArticleCount,
      priority,
      status,
      discoveredAt
    }`,
    {},
  );
}

export async function approveTopicSuggestion(slug: string): Promise<TopicPlan> {
  if (!sanityAdmin) throw new Error("Sanity is not configured");
  if (!process.env.SANITY_TOKEN) throw new Error("SANITY_TOKEN is not configured");

  const suggestion = await sanityAdmin.fetch<TopicSuggestion | null>(
    `*[_type == "editorialTopicSuggestion" && slug.current == $slug][0] {
      "slug": slug.current,
      title,
      keywords,
      reason,
      relatedArticleCount,
      priority,
      status
    }`,
    { slug },
  );
  if (!suggestion) throw new Error(`Unknown topic suggestion: ${slug}`);

  const sanity = createClient({
    projectId: process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.SANITY_DATASET ?? "production",
    token: process.env.SANITY_TOKEN!,
    apiVersion: "2024-01-01",
    useCdn: false,
  });

  await sanity.createOrReplace({
    _id: `editorialTopicPlan-${slug}`,
    _type: "editorialTopicPlan",
    slug: { _type: "slug", current: slug },
    title: suggestion.title,
    keywords: suggestion.keywords,
    status: "approved",
    approvedAt: new Date().toISOString(),
    sourceSuggestionId: `editorialTopicSuggestion-${slug}`,
  });
  await sanity.patch(`editorialTopicSuggestion-${slug}`).set({ status: "approved", approvedAt: new Date().toISOString() }).commit();

  return { slug, title: suggestion.title, keywords: suggestion.keywords };
}

export async function dismissTopicSuggestion(slug: string): Promise<{ slug: string; status: "dismissed" }> {
  if (!process.env.SANITY_TOKEN) throw new Error("SANITY_TOKEN is not configured");
  const sanity = createClient({
    projectId: process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.SANITY_DATASET ?? "production",
    token: process.env.SANITY_TOKEN!,
    apiVersion: "2024-01-01",
    useCdn: false,
  });
  await sanity.patch(`editorialTopicSuggestion-${slug}`).set({ status: "dismissed", dismissedAt: new Date().toISOString() }).commit();
  return { slug, status: "dismissed" };
}

async function getOrCreateDailyHotTopicPlan(): Promise<DailyHotTopicPlan> {
  if (!sanityAdmin) throw new Error("Sanity is not configured");
  if (!process.env.SANITY_TOKEN) throw new Error("SANITY_TOKEN is not configured");

  const date = kyivDateKey();
  const id = `editorialHotPlan-${date}`;
  const existing = await sanityAdmin.fetch<DailyHotTopicPlan | null>(
    `*[_type == "editorialHotPlan" && _id == $id][0]`,
    { id },
  );
  if (existing?.topics?.length) return existing;

  const topics = await rankHotTopics();
  const sanity = createClient({
    projectId: process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.SANITY_DATASET ?? "production",
    token: process.env.SANITY_TOKEN!,
    apiVersion: "2024-01-01",
    useCdn: false,
  });

  const doc = await sanity.createOrReplace({
    _id: id,
    _type: "editorialHotPlan",
    date,
    selectedAt: new Date().toISOString(),
    topics: topics.slice(0, 2),
  });
  return doc as DailyHotTopicPlan;
}

async function rankHotTopics(): Promise<HotTopic[]> {
  if (!sanityAdmin) return [];
  const client = sanityAdmin;
  const plans = await getTopicHubPlans();
  const cutoff24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const cutoff72 = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  const scored = await Promise.all(
    plans.map(async (plan) => {
      const { filter, params } = buildTopicArticleFilter(plan.keywords);
      const [recent24h, recent72h] = await Promise.all([
        client.fetch<number>(
          `count(*[_type == "article" && defined(translations.en.title) && publishedAt >= $cutoff24 && (${filter})])`,
          { ...params, cutoff24 },
        ),
        client.fetch<number>(
          `count(*[_type == "article" && defined(translations.en.title) && publishedAt >= $cutoff72 && (${filter})])`,
          { ...params, cutoff72 },
        ),
      ]);
      return {
        ...plan,
        recent24h,
        recent72h,
        score: recent24h * 3 + recent72h,
      };
    }),
  );

  return scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.recent24h !== a.recent24h) return b.recent24h - a.recent24h;
    return a.title.localeCompare(b.title);
  });
}

function kyivDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kiev",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function pickNextTopicHub(): Promise<TopicPlan> {
  const plans = await getTopicHubPlans();
  if (!sanityAdmin) return plans[0];
  const existing = await sanityAdmin.fetch<Array<{ slug: string; updatedAt?: string }>>(
    `*[_type == "topicHub" && defined(slug.current)] {
      "slug": slug.current,
      updatedAt
    }`,
    {},
  );
  const bySlug = new Map(existing.map((hub) => [hub.slug, hub.updatedAt]));
  return plans
    .slice()
    .sort((a, b) => {
      const aTime = bySlug.get(a.slug) ? new Date(bySlug.get(a.slug)!).getTime() : 0;
      const bTime = bySlug.get(b.slug) ? new Date(bySlug.get(b.slug)!).getTime() : 0;
      return aTime - bTime;
    })[0];
}

async function fetchRelatedArticleInputs(plan: TopicPlan) {
  if (!sanityAdmin) return [];
  const { filter, params } = buildTopicArticleFilter(plan.keywords);
  return sanityAdmin.fetch<RelatedArticleInput[]>(
    `*[_type == "article" && defined(translations.en.title) && (${filter})]
     | order(publishedAt desc)[0...20] {
      "title": translations.en.title,
      "excerpt": translations.en.excerpt,
      "slug": slug.current,
      category,
      publishedAt
    }`,
    params,
  );
}

async function fetchRecentDiscoveryArticles(): Promise<DiscoveryArticleInput[]> {
  if (!sanityAdmin) return [];
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  return sanityAdmin.fetch<DiscoveryArticleInput[]>(
    `*[_type == "article" && publishedAt >= $cutoff && defined(translations.en.title)]
     | order(publishedAt desc)[0...80] {
      "title": translations.en.title,
      "excerpt": translations.en.excerpt,
      "slug": slug.current,
      category,
      publishedAt,
      tags
    }`,
    { cutoff },
  );
}

async function discoverTopicSuggestions(
  articles: DiscoveryArticleInput[],
  existingPlans: TopicPlan[],
): Promise<DiscoveryResult> {
  const articleLines = articles
    .map((article, i) => {
      const date = article.publishedAt ? article.publishedAt.slice(0, 10) : "unknown date";
      const tags = article.tags?.length ? ` tags: ${article.tags.slice(0, 5).join(", ")}` : "";
      return `${i + 1}. ${date} /${article.category}/${article.slug} - ${article.title}: ${(article.excerpt ?? "").slice(0, 180)}${tags}`;
    })
    .join("\n");
  const existingLines = existingPlans
    .map((plan) => `- ${plan.title} (${plan.slug}): ${plan.keywords.join(", ")}`)
    .join("\n");

  const prompt = `You are the FinCNews Topic Discovery Agent.

Analyze FinCNews articles from the last 72 hours and suggest NEW evergreen topic hubs.

Do not write topic hubs. Only suggest candidates for human approval.

Existing approved topic hubs:
${existingLines}

Recent FinCNews articles:
${articleLines}

Discovery criteria:
- Suggest only topics missing from the approved list.
- A topic must be evergreen for at least 3-6 months.
- A topic should have at least 3 related recent articles or a clear multi-article pattern.
- Prefer durable themes: regulation, capital flows, institutional adoption, market structure, corporate treasury activity, technology infrastructure.
- Avoid one-off incidents, one-company stories, temporary rumors, narrow price moves, or duplicate variants of existing hubs.
- Return no more than 5 suggestions.

Each suggestion needs:
- title: broad topic title, not a headline
- slug: lowercase kebab-case
- keywords: 3-6 matching phrases
- reason: concise explanation of the multi-article pattern
- relatedArticleCount: estimated count from the provided article list
- priority: high, medium, or low
- shouldCreateHub: true only if this is worth human review`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1800,
      tools: [
        {
          name: "suggest_topic_hubs",
          description: "Suggest new evergreen topic hub candidates for FinCNews.",
          input_schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              suggestions: {
                type: "array",
                maxItems: 5,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    slug: { type: "string" },
                    keywords: {
                      type: "array",
                      minItems: 3,
                      maxItems: 6,
                      items: { type: "string" },
                    },
                    reason: { type: "string" },
                    relatedArticleCount: { type: "number" },
                    priority: { type: "string", enum: ["high", "medium", "low"] },
                    shouldCreateHub: { type: "boolean" },
                  },
                  required: ["title", "slug", "keywords", "reason", "relatedArticleCount", "priority", "shouldCreateHub"],
                },
              },
            },
            required: ["suggestions"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "suggest_topic_hubs" },
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(40000),
  });

  if (!res.ok) throw new Error(`Topic discovery API error: ${res.status}`);
  const data = await res.json();
  const content = (data as { content?: unknown[] })?.content;
  const block = content?.find((item) => {
    const candidate = item as { type?: string; name?: string };
    return candidate.type === "tool_use" && candidate.name === "suggest_topic_hubs";
  }) as { input?: unknown } | undefined;
  if (!block?.input || typeof block.input !== "object") {
    const preview = JSON.stringify(data).slice(0, 240);
    throw new Error(`Topic discovery did not call suggest_topic_hubs tool: ${preview}`);
  }

  return block.input as DiscoveryResult;
}

async function countRelatedArticlesForKeywords(keywords: string[]): Promise<number> {
  if (!sanityAdmin || keywords.length === 0) return 0;
  const { filter, params } = buildTopicArticleFilter(keywords);
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  return sanityAdmin.fetch<number>(
    `count(*[_type == "article" && defined(translations.en.title) && publishedAt >= $cutoff && (${filter})])`,
    { ...params, cutoff },
  );
}

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function normalizeKeywords(keywords: string[] | undefined, title: string): string[] {
  const unique = new Set([...(keywords ?? []), title]);
  return Array.from(unique)
    .map((keyword) => keyword.trim().toLowerCase())
    .filter((keyword) => keyword.length > 2)
    .slice(0, 6);
}

async function fetchCoverageLogContext(plan: TopicPlan): Promise<string> {
  try {
    const db = supabaseAdmin();
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const orFilter = plan.keywords
      .slice(0, 4)
      .map(k => `title.ilike.%${k}%`)
      .join(',');

    const { data } = await db
      .from('coverage_log')
      .select('title, persona_id, generation_type, created_at')
      .or(orFilter)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(12);

    if (!data?.length) return '';
    const lines = data.map(row => {
      const date = (row.created_at as string ?? '').slice(0, 10);
      return `${date} [${row.persona_id ?? 'unknown'}] ${row.title}`;
    });
    return `\n\nFinCNews team coverage this week (${data.length} articles):\n${lines.join('\n')}`;
  } catch {
    return '';
  }
}

type VictorHubReview = {
  decision: 'approve' | 'edit' | 'block';
  feedback: string;
  priority_fix?: string;
};

async function reviewHubWithVictor(plan: TopicPlan, hub: GeneratedHub, personaId: string): Promise<VictorHubReview> {
  const prompt = `You are Victor Kane, FinCNews Chief Editor. You are reviewing a topic hub written by ${personaId}.

TOPIC: ${plan.title}
TITLE: ${hub.title}
DESCRIPTION: ${hub.description}

BODY PREVIEW (first 1200 chars):
${hub.body.slice(0, 1200)}

FAQS (${hub.faqs.length} total):
${hub.faqs.map(f => `Q: ${f.question}`).join('\n')}

REVIEW CRITERIA
1. Is this genuinely evergreen? (Not a news recap — can it be useful 3 months from now?)
2. Does the FinCNews View section synthesize or just summarize?
3. Does it establish topical authority without being clickbait?
4. Does it reflect the persona's editorial expertise?

DECISION OPTIONS
- approve: publish as-is
- edit: publish but writer needs the priority_fix applied next refresh
- block: do not publish (quality too low or fundamentally wrong direction)

Return ONLY valid JSON: { "decision": "approve|edit|block", "feedback": "one clear sentence", "priority_fix": "what must change — only required for edit or block" }`;

  try {
    const res = await callClaude({
      model: 'claude-sonnet-4-6',
      max_tokens: 250,
      messages: [{ role: 'user', content: prompt }],
    });
    const review = await parseClaudeJson<VictorHubReview>(res);
    const decision = (['approve', 'edit', 'block'] as const).includes(review.decision as 'approve' | 'edit' | 'block')
      ? review.decision
      : 'approve';
    return { decision, feedback: review.feedback ?? '', priority_fix: review.priority_fix };
  } catch {
    return { decision: 'approve', feedback: 'Review unavailable — published without Victor check' };
  }
}

async function logHubContribution(
  plan: TopicPlan,
  personaId: string,
  hub: GeneratedHub,
  review: VictorHubReview,
): Promise<void> {
  try {
    const db = supabaseAdmin();
    await Promise.all([
      db.from('persona_memory').insert({
        persona_id: personaId,
        memory_type: 'hub_contribution',
        content: `Updated topic hub: ${hub.title}`,
        metadata: {
          topic_slug: plan.slug,
          hub_title: hub.title,
          victor_decision: review.decision,
          victor_feedback: review.feedback,
          generated_at: new Date().toISOString(),
        },
      }),
      db.from('persona_memory').insert({
        persona_id: 'victor-kane',
        memory_type: 'hub_review',
        content: `Hub review ${review.decision}: "${hub.title}"`,
        metadata: {
          topic_slug: plan.slug,
          persona_id: personaId,
          decision: review.decision,
          feedback: review.feedback,
          priority_fix: review.priority_fix ?? null,
          reviewed_at: new Date().toISOString(),
        },
      }),
    ]);
  } catch {
    // best effort — don't block publish
  }
}

async function generateHub(
  plan: TopicPlan,
  related: RelatedArticleInput[],
  personaId: string,
  coverageContext: string,
): Promise<GeneratedHub> {
  const articleLines = related.length
    ? related.map((article, i) => {
        const date = article.publishedAt ? article.publishedAt.slice(0, 10) : "unknown date";
        return `${i + 1}. ${date} /${article.category}/${article.slug} - ${article.title}: ${(article.excerpt ?? "").slice(0, 160)}`;
      }).join("\n")
    : "No related articles yet.";

  const prompt = `You are the FinCNews Editorial Authority Agent.

Your task is to create or refresh a high-authority evergreen topic hub that can rank as a long-term destination page for investors, traders, and financially literate readers.

The goal is NOT to summarize recent news.

The goal IS to explain the topic, establish topical authority, connect recent developments to long-term trends, and provide information value beyond individual news articles.

TOPIC

Topic: ${plan.title}

Primary Keywords:
${plan.keywords.join(", ")}

Recent FinCNews Coverage:
${articleLines}${coverageContext}

Allowed Internal Link Targets:
${related.slice(0, 10).map((article) => `- [${article.title}](/${article.category}/${article.slug})`).join("\n") || "- None"}

OUTPUT

Return the topic hub through the create_topic_hub tool.

FIELD REQUIREMENTS

title

* 40-65 characters
* Clear topic hub title
* Optimized for SEO
* Avoid clickbait
* Must reflect the broad topic, not a single news event

description

* 150-165 characters
* Explain why the topic matters
* Written for search results
* Focus on investor relevance

body

Length:

* 1000-1400 words

Format:

* Markdown only

Use EXACTLY these sections and in this order:

## What It Is

## Why It Matters

## Latest Developments

## What to Watch

## FinCNews View

## How FinCNews Covers It

Do not add additional sections.

Do not include:

* H1 title
* FAQ content
* Related links section
* Sources section
* Conclusion section

EDITORIAL OBJECTIVE

Write as a financial editor, not a news summarizer.

The article must:

* Explain the topic clearly.
* Connect developments together.
* Explain causes and consequences.
* Identify structural trends.
* Highlight why investors care.
* Remain useful for months after publication.
* Create information gain beyond the linked articles.

Readers should understand the topic even if they never open a single linked article.

EVERGREEN PRIORITY

Evergreen content comes first.

Recent coverage should only be used as supporting evidence for:

* adoption trends
* market structure
* institutional behavior
* regulatory direction
* investor sentiment
* technological evolution
* macroeconomic relevance

Avoid chronological news recaps.

Avoid "this happened, then this happened" reporting.

INFORMATION GAIN REQUIREMENT

Every major section must contain at least one of:

* synthesis
* comparison
* pattern
* relationship
* implication
* contextual insight

Do not merely repeat facts from source articles.

Connect developments together and explain what they mean.

EDITORIAL WEIGHTING

Not all developments are equally important.

Prioritize:

1. Institutional adoption
2. Regulatory developments
3. Capital flows
4. Corporate treasury activity
5. Market structure changes
6. Technology and infrastructure improvements

Minor ecosystem stories should receive less emphasis.

SEO REQUIREMENTS

Naturally cover:

* primary keyword
* major entities
* related concepts
* common search intents

Aim for topical completeness.

Avoid keyword stuffing.

The content should naturally satisfy readers searching for:

* what it is
* why it matters
* how it works
* current state
* future direction

EEAT REQUIREMENTS

Write with editorial authority.

Avoid:

* hype
* speculation
* promotional language
* unsupported predictions

Use only information that can reasonably be derived from the coverage provided.

Do not invent:

* prices
* dates
* legislation status
* statistics
* market data

INTERNAL LINKS

Include 4-8 contextual markdown links.

Requirements:

* Use descriptive anchor text.
* Place links naturally inside paragraphs.
* Never place links in a standalone list.
* Never create a "Related Coverage" section.
* Only use URLs from the Allowed Internal Link Targets list.

Example:

[Bitcoin ETF outflow streak](/crypto/bitcoin-etfs-2-8b-outflow-streak)

FINCNEWS VIEW SECTION

The "FinCNews View" section must provide editorial synthesis.

Explain:

* what appears structural
* what appears temporary
* which trends matter most
* why investors should pay attention

Do not make unsupported forecasts.

FAQS

Generate 4-6 FAQs.

Requirements:

* Real user questions
* Clear factual answers
* 2-4 sentences per answer
* No speculation
* No investment advice

FAQs must appear ONLY inside the "faqs" array.

QUALITY STANDARD

The final article should read like a durable authority page that could remain valuable for 3-6 months with only minor updates.

It should feel closer to a premium financial publication's topic hub than to a standard crypto news article.`;

  const systemPrompt = PERSONA_HUB_VOICE[personaId] ?? PERSONA_HUB_VOICE['marcus-webb'];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      system: systemPrompt,
      max_tokens: 5200,
      tools: [
        {
          name: "create_topic_hub",
          description: "Create or refresh a FinCNews evergreen topic hub.",
          input_schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: {
                type: "string",
                description: "Clear SEO topic hub title, 40-65 characters.",
              },
              description: {
                type: "string",
                description: "Search-result meta description, 150-165 characters.",
              },
              body: {
                type: "string",
                description: "Markdown body using the required section structure.",
              },
              faqs: {
                type: "array",
                minItems: 4,
                maxItems: 6,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    question: { type: "string" },
                    answer: { type: "string" },
                  },
                  required: ["question", "answer"],
                },
              },
            },
            required: ["title", "description", "body", "faqs"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "create_topic_hub" },
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) throw new Error(`Editorial agent API error: ${res.status}`);
  const data = await res.json();
  const parsed = extractToolInput(data);
  if (!parsed.title || !parsed.description || !parsed.body) {
    throw new Error("Editorial agent returned incomplete topic hub");
  }
  return {
    ...parsed,
    body: ensureContextualInternalLinks(parsed.body, related),
    faqs: Array.isArray(parsed.faqs) ? parsed.faqs.slice(0, 6) : [],
  };
}

function extractToolInput(data: unknown): GeneratedHub {
  const content = (data as { content?: unknown[] })?.content;
  const block = content?.find((item) => {
    const candidate = item as { type?: string; name?: string };
    return candidate.type === "tool_use" && candidate.name === "create_topic_hub";
  }) as { input?: unknown } | undefined;

  if (!block?.input || typeof block.input !== "object") {
    const preview = JSON.stringify(data).slice(0, 240);
    throw new Error(`Editorial agent did not call create_topic_hub tool: ${preview}`);
  }

  return block.input as GeneratedHub;
}

function ensureContextualInternalLinks(body: string, related: RelatedArticleInput[]): string {
  const clean = stripRelatedAppendix(body);
  const linkCount = (clean.match(/\[[^\]]+\]\(\/(?:crypto|markets|economy|fintech|policy|companies)\/[a-z0-9-]+\)/g) ?? []).length;
  if (linkCount >= 4 || related.length === 0) return clean;

  const links = related.slice(0, 5).map((article) => ({
    title: article.title
      .replace(/\s+/g, " ")
      .replace(/[:|].*$/, "")
      .trim(),
    href: `/${article.category}/${article.slug}`,
  }));
  const sentence = `For recent FinCNews reporting, compare ${links
    .map((link) => `[${link.title}](${link.href})`)
    .join(", ")} to see how this topic is developing across live market coverage.`;

  const marker = "## How FinCNews Covers It";
  if (clean.includes(marker)) {
    return clean.replace(marker, `${marker}\n\n${sentence}`);
  }
  return `${clean.trim()}\n\n## How FinCNews Covers It\n\n${sentence}`;
}

function stripRelatedAppendix(body: string): string {
  return body
    .replace(/\n-{3,}\s*\n(?:\*\*)?Explore related coverage:?(?:\*\*)?[\s\S]*?(?=\n##\s+FAQ|\nFAQ\s*$|$)/i, "\n")
    .replace(/\n(?:\*\*)?Explore related coverage:?(?:\*\*)?[\s\S]*?(?=\n##\s+FAQ|\nFAQ\s*$|$)/i, "\n");
}

function normalizeBody(body: string, related: RelatedArticleInput[] = []): PortableTextBlock[] {
  const linkedBody = ensureContextualInternalLinks(body, related);
  const beforeFaq = linkedBody.split(/\n\s*FAQ\s*\n/i)[0] ?? linkedBody;
  const lines = beforeFaq
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index) => !(index === 0 && /^#\s+/.test(line)));

  let listIndex = 0;
  return lines.flatMap((line, i) => {
    if (/^---+$/.test(line)) return [];

    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    const bullet = line.match(/^[-*]\s+(.+)$/);
    const sectionHeading = line.match(/^(What It Is|Why It Matters|Latest Developments|What to Watch|FinCNews View|How FinCNews Covers It)$/i);
    const style = h2 || sectionHeading ? "h2" : h3 ? "h3" : "normal";
    const text = h2?.[1] ?? h3?.[1] ?? bullet?.[1] ?? sectionHeading?.[1] ?? line;
    const parsed = parseInline(text, i);

    return [{
      _type: "block" as const,
      _key: bullet ? `hub-list-${listIndex++}` : `hub-${i}`,
      style,
      ...(bullet ? { listItem: "bullet", level: 1 } : {}),
      markDefs: parsed.markDefs,
      children: parsed.children,
    } as PortableTextBlock];
  });
}

function parseInline(text: string, blockIndex: number) {
  const markDefs: Array<{ _type: "link"; _key: string; href: string }> = [];
  const children: Array<{ _type: "span"; _key: string; text: string; marks: string[] }> = [];
  const re = /(\*\*([^*]+)\*\*)|\[([^\]]+)\]\(([^)]+)\)|(\/(?:crypto|markets|economy|fintech|policy|companies)\/[a-z0-9-]+)/g;
  let last = 0;
  let spanIndex = 0;
  let match: RegExpExecArray | null;

  function pushSpan(value: string, marks: string[] = []) {
    if (!value) return;
    children.push({ _type: "span", _key: `hub-s-${blockIndex}-${spanIndex++}`, text: value, marks });
  }

  while ((match = re.exec(text)) !== null) {
    pushSpan(text.slice(last, match.index));
    if (match[2]) {
      pushSpan(match[2], ["strong"]);
    } else {
      const label = match[3] ?? match[5];
      const href = match[4] ?? match[5];
      const key = `hub-link-${blockIndex}-${spanIndex}`;
      markDefs.push({ _type: "link", _key: key, href });
      pushSpan(label, [key]);
    }
    last = match.index + match[0].length;
  }

  pushSpan(text.slice(last));
  return { markDefs, children };
}
