import { supabaseAdmin } from '@/lib/supabase';
import { publishArticleToSanity, callClaude, parseClaudeJson, type PublishableArticle } from '@/lib/personas/shared';
import { saveEmbedding } from '@/lib/personas/embeddings';
import type { MarcusDataPull } from './data-pull';
import type { MarcusBaseline } from './baseline';
import { updateBaseline } from './baseline';
import { verifyOpenForecasts } from './forecasts';

const PERSONA_ID = 'marcus-webb';

export type SelfWorkType = 'bootstrap' | 'weekly_summary' | 'update_baseline_only';

export interface SelfWorkTask { type: SelfWorkType; }

export interface SelfWorkResult {
  wrote:            boolean;
  type:             SelfWorkType | 'silent';
  articleSlug?:     string;
  articleCategory?: string;
  reasoning:        string;
  baselineUpdated:  boolean;
  forecastsVerified?: { verified: number; correct: number };
}

// ── Decision ──────────────────────────────────────────────────────────────────

export async function decideSelfWork(): Promise<SelfWorkTask> {
  const db = supabaseAdmin();
  const { count } = await db
    .from('persona_memory')
    .select('*', { count: 'exact', head: true })
    .eq('persona_id', PERSONA_ID)
    .in('memory_type', ['article', 'context']);

  if ((count ?? 0) === 0) return { type: 'bootstrap' };

  if (new Date().getDay() === 5) { // Friday
    const { count: weekArticles } = await db
      .from('persona_memory')
      .select('*', { count: 'exact', head: true })
      .eq('persona_id', PERSONA_ID)
      .eq('memory_type', 'article')
      .gte('created_at', getWeekStart());
    if ((weekArticles ?? 0) === 0) return { type: 'weekly_summary' };
  }

  return { type: 'update_baseline_only' };
}

// ── Executor ──────────────────────────────────────────────────────────────────

export async function executeSelfWork(
  task:     SelfWorkTask,
  data:     MarcusDataPull,
  baseline: MarcusBaseline,
  context:  string
): Promise<SelfWorkResult> {
  const updatedBaseline = await updateBaseline(data);
  const forecasts = await verifyOpenForecasts(data.btcPrice);

  if (task.type === 'update_baseline_only') {
    return {
      wrote:            false,
      type:             'update_baseline_only',
      reasoning:        `Baseline updated (${updatedBaseline.samples} samples). Forecasts checked: ${forecasts.verified} verified.`,
      baselineUpdated:  true,
      forecastsVerified: forecasts,
    };
  }

  let article: PublishableArticle;
  if (task.type === 'bootstrap') {
    article = await generateBootstrap(data, baseline);
  } else {
    article = await generateWeeklySummary(data, baseline, context);
  }

  const { slug, id } = await publishArticleToSanity(article, PERSONA_ID);
  const db = supabaseAdmin();
  const memType = task.type === 'bootstrap' ? 'context' : 'article';
  const { data: memRow } = await db.from('persona_memory').insert({
    persona_id:  PERSONA_ID,
    memory_type: memType,
    content:     `${article.title}\n\n${article.excerpt}`,
    metadata:    { slug, title: article.title, topic: task.type, sanity_id: id, self_work: true },
  }).select('id').single();

  if (memRow?.id) void saveEmbedding(memRow.id, `${article.title}\n\n${article.excerpt}`);

  return {
    wrote:            true,
    type:             task.type,
    articleSlug:      slug,
    articleCategory:  article.category,
    reasoning:        `Self-work: ${task.type}`,
    baselineUpdated:  true,
    forecastsVerified: forecasts,
  };
}

// ── Generators ────────────────────────────────────────────────────────────────

async function generateBootstrap(data: MarcusDataPull, baseline: MarcusBaseline): Promise<PublishableArticle> {
  const prompt = `You are Marcus Webb, on-chain data analyst at finc.news. This is your first article.

Write a perspective piece that establishes your on-chain analysis framework. Do NOT open with "Hi I'm Marcus." Start with the analytical point — your credentials emerge through the argument.

WHAT THIS ARTICLE MUST ESTABLISH:
1. Your core thesis: markets are flows, everything leaves an on-chain trace
2. Background: 8 years institutional finance, 6 years crypto, 4 years on-chain surveillance
3. Current on-chain snapshot using today's data
4. Your framework: anomaly detection based on z-scores, what metrics you watch and why
5. What you'll be writing about (no meta disclaimers — show through the analysis)

TODAY'S ON-CHAIN DATA:
- BTC Price: $${data.btcPrice.toLocaleString()}
- Exchange Netflow: ${data.btcExchangeNetflow.toFixed(0)} BTC (${data.btcExchangeNetflow > 0 ? 'inflows' : 'outflows'})
- Volume vs 30d avg: ${data.btcVolumeRatio.toFixed(2)}x
- Hashrate: ${(data.btcHashrate / 1e6).toFixed(2)} EH/s
- Mempool Tx: ${data.mempoolTxCount.toLocaleString()}
- Fear & Greed: ${data.fearGreedIndex}/100
Baseline samples: ${baseline.samples} (accumulating)

TONE: Bloomberg terminal. Dry, data-driven, authoritative.
LENGTH: ~450 words. CATEGORY: crypto

Return ONLY valid JSON:
{
  "title": "thesis title starting with a data point or claim",
  "excerpt": "2-3 sentences leading with the on-chain thesis (max 220 chars)",
  "body": "full article in markdown, use ## for headers",
  "metaTitle": "max 60 chars",
  "metaDescription": "max 155 chars",
  "tags": ["on-chain", "bitcoin", "exchange-flows"],
  "category": "crypto",
  "telegramText": "5-7 lines. Numbers first. Source in parens. End with {URL}"
}`;

  const res = await callClaude({ model: 'claude-sonnet-4-5', max_tokens: 2400, messages: [{ role: 'user', content: prompt }] });
  return parseClaudeJson<PublishableArticle>(res);
}

async function generateWeeklySummary(data: MarcusDataPull, baseline: MarcusBaseline, context: string): Promise<PublishableArticle> {
  const prompt = `You are Marcus Webb, on-chain data analyst at finc.news.

Write a weekly on-chain snapshot for the week ending ${new Date().toDateString()}.

STRUCTURE:
- Current state of each key metric vs 30-day baseline (no anomalies this week = routine)
- Any notable shifts even if below anomaly threshold
- What to watch next week — one specific signal
- Under 400 words

CURRENT DATA:
- Exchange Netflow: ${data.btcExchangeNetflow.toFixed(0)} BTC (mean: ${baseline.metrics.btcExchangeNetflow.mean.toFixed(0)})
- Volume Ratio: ${data.btcVolumeRatio.toFixed(2)}x (mean: ${baseline.metrics.btcVolumeRatio.mean.toFixed(2)})
- Hashrate: ${(data.btcHashrate / 1e6).toFixed(2)} EH/s (mean: ${(baseline.metrics.btcHashrate.mean / 1e6).toFixed(2)})
- Fear & Greed: ${data.fearGreedIndex}/100

RECENT ARTICLES: ${context || 'None this week'}

Return ONLY valid JSON:
{
  "title": "Weekly On-Chain Snapshot: [Date Range]",
  "excerpt": "Brief weekly on-chain summary (max 200 chars)",
  "body": "full article in markdown",
  "metaTitle": "Weekly On-Chain: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} | FinCNews",
  "metaDescription": "Marcus Webb weekly on-chain metrics snapshot",
  "tags": ["on-chain", "bitcoin", "weekly"],
  "category": "crypto",
  "telegramText": "5-6 lines. Key metrics. End with {URL}"
}`;

  const res = await callClaude({ model: 'claude-haiku-4-5-20251001', max_tokens: 1600, messages: [{ role: 'user', content: prompt }] });
  return parseClaudeJson<PublishableArticle>(res);
}

function getWeekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
