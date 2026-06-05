import { supabaseAdmin } from '@/lib/supabase';
import { publishArticleToSanity, callClaude, parseClaudeJson, type PublishableArticle } from '@/lib/personas/shared';
import { saveEmbedding } from '@/lib/personas/embeddings';
import { extractAndSaveForecast } from './forecasts';
import { extractAndSavePosition } from './position';
import type { ElenaDataPull } from './data-pull';

const PERSONA_ID = 'elena-voss';

// Shared calendar — same source of truth as should-write.ts
export const HIGH_PRIORITY_DATES: Record<string, string> = {
  '2025-06-11': 'CPI Release',
  '2025-06-12': 'FOMC Rate Decision',
  '2025-06-18': 'FOMC Minutes',
  '2025-06-27': 'PCE Release',
  '2025-07-04': 'NFP Release',
  '2025-07-09': 'CPI Release',
  '2025-07-16': 'FOMC Minutes',
  '2025-07-30': 'FOMC Rate Decision',
  '2025-08-01': 'NFP Release',
  '2025-08-13': 'CPI Release',
  '2025-08-22': 'PCE Release',
  '2025-09-05': 'NFP Release',
  '2025-09-10': 'CPI Release',
  '2025-09-17': 'FOMC Rate Decision',
  '2025-09-26': 'PCE Release',
  '2026-01-29': 'FOMC Rate Decision',
  '2026-02-11': 'CPI Release',
  '2026-02-27': 'PCE Release',
  '2026-03-18': 'FOMC Rate Decision',
  '2026-04-10': 'CPI Release',
  '2026-05-06': 'FOMC Rate Decision',
  '2026-06-05': 'NFP Release',
  '2026-06-10': 'CPI Release',
  '2026-06-17': 'FOMC Rate Decision',
};

export type SelfWorkType = 'bootstrap' | 'weekly_preview' | 'weekly_summary' | 'event_preview';

export interface SelfWorkTask {
  type: SelfWorkType;
  eventName?: string; // for event_preview
}

export interface SelfWorkResult {
  wrote: boolean;
  type: SelfWorkType | 'silent';
  articleSlug?: string;
  articleCategory?: string;
  reasoning: string;
}

// ─── Decision logic ─────────────────────────────────────────────────────────

export async function decideSelfWork(): Promise<SelfWorkTask | null> {
  const db = supabaseAdmin();

  const { count: totalArticles } = await db
    .from('persona_memory')
    .select('*', { count: 'exact', head: true })
    .eq('persona_id', PERSONA_ID)
    .in('memory_type', ['article', 'context']);

  // Bootstrap: very first run, zero history
  if ((totalArticles ?? 0) === 0) {
    return { type: 'bootstrap' };
  }

  // Articles written this calendar week (Mon–Sun)
  const { count: articlesThisWeek } = await db
    .from('persona_memory')
    .select('*', { count: 'exact', head: true })
    .eq('persona_id', PERSONA_ID)
    .eq('memory_type', 'article')
    .gte('created_at', getWeekStart());

  const dow = new Date().getDay(); // 0=Sun … 6=Sat
  const tomorrowEvent = HIGH_PRIORITY_DATES[getTomorrowKey()] ?? null;
  const wrote = articlesThisWeek ?? 0;

  // Day-before preview: always write if big event tomorrow and silent so far today
  if (tomorrowEvent && wrote === 0) return { type: 'event_preview', eventName: tomorrowEvent };

  // Monday with no article yet this week → weekly preview
  if (dow === 1 && wrote === 0) return { type: 'weekly_preview' };

  // Friday with 0 articles this whole week → weekly summary
  if (dow === 5 && wrote === 0) return { type: 'weekly_summary' };

  return null; // genuinely quiet — log and do nothing
}

// ─── Executor ────────────────────────────────────────────────────────────────

export async function executeSelfWork(
  task: SelfWorkTask,
  data: ElenaDataPull,
  recentContext: string
): Promise<SelfWorkResult> {
  let article: PublishableArticle;

  switch (task.type) {
    case 'bootstrap':
      article = await generateBootstrap(data);
      break;
    case 'weekly_preview':
      article = await generateWeeklyPreview(data);
      break;
    case 'weekly_summary':
      article = await generateWeeklySummary(data, recentContext);
      break;
    case 'event_preview':
      article = await generateEventPreview(data, task.eventName!);
      break;
  }

  const { slug, id } = await publishArticleToSanity(article, PERSONA_ID);

  const memoryType = task.type === 'bootstrap' ? 'context' : 'article';
  const memId = await saveMemory(slug, id, article, memoryType, task.type);

  // Fire-and-forget: embed, extract forecast + position
  if (memId) void saveEmbedding(memId, `${article.title}\n\n${article.excerpt}`);
  void extractAndSaveForecast(article.title, article.body, slug);
  void extractAndSavePosition(article.title, article.excerpt, article.body);

  return {
    wrote: true,
    type: task.type,
    articleSlug: slug,
    articleCategory: article.category,
    reasoning: `Self-work: ${task.type}${task.eventName ? ` (${task.eventName})` : ''}`,
  };
}

// ─── Generators ─────────────────────────────────────────────────────────────

async function generateBootstrap(data: ElenaDataPull): Promise<PublishableArticle> {
  const prompt = `You are Elena Voss, macro analyst at finc.news. This is your first article.

Write a perspective piece that establishes your analytical framework. Do NOT open with
"Hi I'm Elena" — open with your analytical thesis. Your background should emerge naturally
in the text, not as a formal introduction.

WHAT THIS ARTICLE MUST ESTABLISH:
1. Your core thesis: BTC is a risk asset governed by the same liquidity forces as everything else
2. Your credentials woven in: 12 years TradFi — fixed income at Deutsche Bank, macro at a
   European family office, reluctant crypto convert since 2021
3. Current macro backdrop using today's real numbers below
4. Your analytical framework: what you watch (Fed language precision, yield curve shape,
   dollar strength, BTC/risk-asset correlation) and WHY each metric matters
5. What you will be writing about going forward — set reader expectations
6. Close with one specific macro signal you're watching right now

TODAY'S MACRO DATA (use these real numbers, don't invent others):
- Fed Funds Rate: ${data.fedFundsRate}%
- CPI YoY: ${data.cpiYoY}%
- Core PCE YoY: ${data.corePce}%
- 10Y Treasury: ${data.tenYearYield}%
- 2Y Treasury: ${data.twoYearYield}%
- Yield Curve (10Y-2Y): ${data.yieldCurveSpread.toFixed(2)}%${data.yieldCurveSpread < 0 ? ' — INVERTED' : ''}
- USD Broad Index: ${data.dxyIndex}
- BTC 24h: ${data.btcChange24h.toFixed(2)}%

TONE: This is a manifesto, not a press release. Direct, analytical, slightly skeptical of
the crypto-native worldview. No hype. No price predictions.
LENGTH: ~600 words (this is the foundation — longer than a normal article)
CATEGORY: economy

Return ONLY valid JSON:
{
  "title": "compelling thesis-driven title, not a listicle",
  "excerpt": "2-3 sentences that make a TradFi reader want to read this (max 220 chars)",
  "body": "full article in markdown, use ## for headers, ~600 words",
  "metaTitle": "SEO title max 60 chars",
  "metaDescription": "SEO description max 155 chars",
  "tags": ["macro", "fed-policy", "bitcoin", "rates"],
  "category": "economy",
  "telegramText": "5-7 tight lines. Lead with the macro thesis. End with {URL}"
}`;

  const res = await callClaude({
    model: 'claude-sonnet-4-5',
    max_tokens: 2800,
    messages: [{ role: 'user', content: prompt }],
  });
  return parseClaudeJson<PublishableArticle>(res);
}

async function generateWeeklyPreview(data: ElenaDataPull): Promise<PublishableArticle> {
  const upcomingEvents = getUpcomingEvents(7);
  const dateRange = getWeekDateRange();

  const prompt = `You are Elena Voss, macro analyst at finc.news.

Write a weekly macro preview for the week of ${dateRange}.

STRUCTURE:
- Opening: 1-sentence current macro baseline (where things stand right now)
- Key events this week — for each: date, what to expect, why it matters for crypto
- One metric to watch all week
- Under 350 words — this is a preview, not analysis

CURRENT MACRO BASELINE:
- Fed Funds Rate: ${data.fedFundsRate}%
- 10Y Yield: ${data.tenYearYield}% | 2Y: ${data.twoYearYield}% | Spread: ${data.yieldCurveSpread.toFixed(2)}%
- USD Broad Index: ${data.dxyIndex}
- BTC 24h: ${data.btcChange24h.toFixed(2)}%

EVENTS THIS WEEK:
${upcomingEvents.length > 0 ? upcomingEvents.map(e => `- ${e.date}: ${e.event}`).join('\n') : 'No major scheduled events — quiet macro week'}

Return ONLY valid JSON:
{
  "title": "Macro Week Ahead: ${dateRange}",
  "excerpt": "Brief preview of the macro week ahead (max 200 chars)",
  "body": "full article in markdown",
  "metaTitle": "Macro Week Ahead: ${dateRange} | FinCNews",
  "metaDescription": "Elena Voss previews the key macro events for the week of ${dateRange}",
  "tags": ["macro", "fed-policy", "weekly-preview"],
  "category": "economy",
  "telegramText": "5-6 lines. Key events + what to watch. End with {URL}"
}`;

  const res = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1400,
    messages: [{ role: 'user', content: prompt }],
  });
  return parseClaudeJson<PublishableArticle>(res);
}

async function generateWeeklySummary(data: ElenaDataPull, recentContext: string): Promise<PublishableArticle> {
  const dateRange = getWeekDateRange();

  const prompt = `You are Elena Voss, macro analyst at finc.news.

Write a weekly macro summary for the week ending ${new Date().toDateString()}.

STRUCTURE:
- What moved (or didn't move) in macro this week
- Key signal: yield curve, DXY, BTC correlation — any notable shifts
- What it means for crypto positioning going into next week
- Under 350 words

IF YOU WROTE NOTHING THIS WEEK: acknowledge it was a quiet macro week, briefly explain why
quiet macro weeks can be meaningful signals in themselves, close with what to watch next week.

CURRENT MACRO DATA:
- Fed Funds Rate: ${data.fedFundsRate}%
- CPI YoY: ${data.cpiYoY}% | Core PCE: ${data.corePce}%
- 10Y: ${data.tenYearYield}% | 2Y: ${data.twoYearYield}% | Spread: ${data.yieldCurveSpread.toFixed(2)}%
- USD Broad Index: ${data.dxyIndex}
- BTC 24h: ${data.btcChange24h.toFixed(2)}%

WHAT YOU COVERED THIS WEEK:
${recentContext || 'Nothing — this was a silent week for macro signals'}

NEXT WEEK EVENTS:
${getUpcomingEvents(14).filter(e => new Date(e.date) > new Date()).slice(0, 4).map(e => `- ${e.date}: ${e.event}`).join('\n') || 'No major events scheduled'}

Return ONLY valid JSON:
{
  "title": "Fed Watch Weekly: ${dateRange}",
  "excerpt": "Weekly macro recap from Elena Voss (max 200 chars)",
  "body": "full article in markdown",
  "metaTitle": "Fed Watch Weekly: ${dateRange} | FinCNews",
  "metaDescription": "Elena Voss weekly macro recap for the week of ${dateRange}",
  "tags": ["macro", "fed-policy", "weekly-summary"],
  "category": "economy",
  "telegramText": "5-6 lines. Key macro takeaways. End with {URL}"
}`;

  const res = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1400,
    messages: [{ role: 'user', content: prompt }],
  });
  return parseClaudeJson<PublishableArticle>(res);
}

async function generateEventPreview(data: ElenaDataPull, eventName: string): Promise<PublishableArticle> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const prompt = `You are Elena Voss, macro analyst at finc.news.

Tomorrow is ${eventName} (${tomorrowStr}). Write a preview article.

STRUCTURE:
1. What's expected — consensus or market pricing
2. What to watch in the release: specific number (for CPI/PCE/NFP) or specific language (for FOMC)
3. The scenario matrix: what happens to crypto if above/below/in-line with expectations
4. Your read: based on current data, which direction do you lean and why
5. Under 400 words

CURRENT MACRO DATA (for context):
- Fed Funds Rate: ${data.fedFundsRate}%
- CPI YoY: ${data.cpiYoY}% | Core PCE: ${data.corePce}%
- 10Y: ${data.tenYearYield}% | 2Y: ${data.twoYearYield}% | Spread: ${data.yieldCurveSpread.toFixed(2)}%
- USD Broad Index: ${data.dxyIndex}
- BTC 24h: ${data.btcChange24h.toFixed(2)}%

Return ONLY valid JSON:
{
  "title": "Tomorrow's ${eventName}: What to Watch",
  "excerpt": "Elena Voss previews ${eventName} and what it means for crypto (max 200 chars)",
  "body": "full article in markdown",
  "metaTitle": "${eventName} Preview: What Markets Are Watching | FinCNews",
  "metaDescription": "Elena Voss previews tomorrow's ${eventName} and the implications for Bitcoin and crypto markets",
  "tags": ["macro", "fed-policy", "${eventName.toLowerCase().replace(/\s+/g, '-')}"],
  "category": "economy",
  "telegramText": "5-6 lines. Key thresholds + scenarios. End with {URL}"
}`;

  const res = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1600,
    messages: [{ role: 'user', content: prompt }],
  });
  return parseClaudeJson<PublishableArticle>(res);
}

// ─── Memory ──────────────────────────────────────────────────────────────────

async function saveMemory(
  slug: string,
  sanityId: string,
  article: PublishableArticle,
  memoryType: 'article' | 'context',
  taskType: SelfWorkType
): Promise<string | null> {
  const db = supabaseAdmin();
  const { data } = await db.from('persona_memory').insert({
    persona_id:  PERSONA_ID,
    memory_type: memoryType,
    content:     `${article.title}\n\n${article.excerpt}`,
    metadata: {
      slug,
      title:      article.title,
      topic:      taskType,
      sanity_id:  sanityId,
      tags:       article.tags,
      self_work:  true,
      task_type:  taskType,
    },
  }).select('id').single();
  return data?.id ?? null;
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function getTomorrowKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function getWeekDateRange(): string {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(mon)}–${fmt(fri)}`;
}

function getUpcomingEvents(days: number): { date: string; event: string }[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return Object.entries(HIGH_PRIORITY_DATES)
    .filter(([date]) => {
      const d = new Date(date);
      return d >= now && d <= cutoff;
    })
    .map(([date, event]) => ({ date, event }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
