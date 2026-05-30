import { createClient } from "@sanity/client";
import { sanityAdmin, type PortableTextBlock } from "@/lib/sanity";
import { buildTopicArticleFilter } from "@/lib/topic-matching";

type TopicPlan = {
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

export const TOPIC_HUB_PLANS: TopicPlan[] = [
  { slug: "bitcoin", title: "Bitcoin", keywords: ["bitcoin", "btc", "spot bitcoin etf", "bitcoin treasury"] },
  { slug: "ethereum", title: "Ethereum", keywords: ["ethereum", "eth", "staking", "layer 2"] },
  { slug: "crypto-etfs", title: "Crypto ETFs", keywords: ["bitcoin etf", "ethereum etf", "spot etf", "etf inflows"] },
  { slug: "sec-crypto", title: "SEC Crypto Regulation", keywords: ["sec", "crypto regulation", "broker dealer", "tokenized stocks"] },
  { slug: "federal-reserve", title: "Federal Reserve Policy", keywords: ["fed", "federal reserve", "rate cut", "rate hike", "cpi"] },
  { slug: "stablecoins", title: "Stablecoins", keywords: ["stablecoin", "usdc", "tether", "cbdc", "payments"] },
  { slug: "xrp", title: "XRP", keywords: ["xrp", "ripple", "xrpl", "xrp etf"] },
  { slug: "solana", title: "Solana", keywords: ["solana", "sol", "solana defi", "solana etf"] },
];

export type EditorialAgentResult = {
  slug: string;
  title: string;
  relatedArticles: number;
  sanityId: string;
};

export async function runEditorialAgent(slug?: string): Promise<EditorialAgentResult> {
  if (!sanityAdmin) throw new Error("Sanity is not configured");
  if (!process.env.SANITY_TOKEN) throw new Error("SANITY_TOKEN is not configured");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

  const plan = slug
    ? TOPIC_HUB_PLANS.find((item) => item.slug === slug)
    : await pickNextTopicHub();
  if (!plan) throw new Error(`Unknown topic hub: ${slug}`);

  const related = await fetchRelatedArticleInputs(plan);
  const generated = await generateHub(plan, related);
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
    body: normalizeBody(generated.body),
    faqs: generated.faqs,
  });

  return {
    slug: plan.slug,
    title: generated.title,
    relatedArticles: related.length,
    sanityId: doc._id,
  };
}

async function pickNextTopicHub(): Promise<TopicPlan> {
  if (!sanityAdmin) return TOPIC_HUB_PLANS[0];
  const existing = await sanityAdmin.fetch<Array<{ slug: string; updatedAt?: string }>>(
    `*[_type == "topicHub" && defined(slug.current)] {
      "slug": slug.current,
      updatedAt
    }`,
    {},
  );
  const bySlug = new Map(existing.map((hub) => [hub.slug, hub.updatedAt]));
  return TOPIC_HUB_PLANS
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
  return sanityAdmin.fetch<Array<{ title: string; excerpt?: string; slug: string; category: string; publishedAt?: string }>>(
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

async function generateHub(
  plan: TopicPlan,
  related: Array<{ title: string; excerpt?: string; slug: string; category: string; publishedAt?: string }>,
): Promise<GeneratedHub> {
  const articleLines = related.length
    ? related.map((article, i) => {
        const date = article.publishedAt ? article.publishedAt.slice(0, 10) : "unknown date";
        return `${i + 1}. ${date} /${article.category}/${article.slug} - ${article.title}: ${(article.excerpt ?? "").slice(0, 160)}`;
      }).join("\n")
    : "No related articles yet.";

  const prompt = `You are the FinCNews editorial authority agent.

Create or refresh an evergreen SEO topic hub.

Topic: ${plan.title}
Keywords: ${plan.keywords.join(", ")}

Recent FinCNews coverage:
${articleLines}

Output ONLY raw JSON:
{
  "title": "clear topic hub title, 40-65 chars",
  "description": "150-165 char meta description explaining why this topic matters",
  "body": "900-1200 words in markdown. Use sections: ## What It Is, ## Why It Matters, ## Latest Developments, ## What to Watch, ## How FinCNews Covers It. Link to internal article paths when useful using plain URLs from the recent coverage list.",
  "faqs": [
    {"question":"...", "answer":"2-3 sentence factual answer"}
  ]
}

Rules:
- Evergreen first, news context second.
- Do not invent prices, dates, legislation status, or market data not present in the coverage list.
- Explain concepts plainly for investors and crypto readers.
- Make the hub distinct from a news article; it should act as a durable landing page.
- Include 4-6 FAQs.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2600,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(55000),
  });

  if (!res.ok) throw new Error(`Editorial agent API error: ${res.status}`);
  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Editorial agent returned non-JSON");

  const parsed = JSON.parse(jsonMatch[0]) as GeneratedHub;
  if (!parsed.title || !parsed.description || !parsed.body) {
    throw new Error("Editorial agent returned incomplete topic hub");
  }
  return {
    ...parsed,
    faqs: Array.isArray(parsed.faqs) ? parsed.faqs.slice(0, 6) : [],
  };
}

function normalizeBody(body: string): PortableTextBlock[] {
  return body
    .split(/\n{2,}/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, i) => {
      const h2 = text.match(/^##\s+(.+)$/);
      const h3 = text.match(/^###\s+(.+)$/);
      return {
        _type: "block" as const,
        _key: `hub-${i}`,
        style: (h2 ? "h2" : h3 ? "h3" : "normal") as string,
        markDefs: [],
        children: [{ _type: "span" as const, _key: `hub-s-${i}`, text: h2?.[1] ?? h3?.[1] ?? text, marks: [] }],
      };
    });
}
