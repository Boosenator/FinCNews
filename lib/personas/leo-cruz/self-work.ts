import { supabaseAdmin } from '@/lib/supabase';
import { publishArticleToSanity, callClaude, parseClaudeJson, type PublishableArticle } from '@/lib/personas/shared';
import { saveEmbedding } from '@/lib/personas/embeddings';
import type { LeoDataPull } from './data-pull';
import type { NarrativeState } from './narratives';
import { updateNarrativeTracker } from './narratives';
import { victorPrePublishReview, applyVictorEdit, type DeskArticle } from '@/lib/automation/generate-desk';

const PERSONA_ID = 'leo-cruz';

export type SelfWorkType = 'bootstrap' | 'weekly_narrative_map' | 'update_tracker_only';

export interface SelfWorkTask {
  type: SelfWorkType;
}

export interface SelfWorkResult {
  wrote:           boolean;
  type:            SelfWorkType | 'silent';
  articleSlug?:    string;
  articleCategory?: string;
  reasoning:       string;
  trackerUpdates?: { added: string[]; advanced: string[]; faded: string[] };
}

// ── Decision ──────────────────────────────────────────────────────────────────

export async function decideSelfWork(): Promise<SelfWorkTask> {
  const db = supabaseAdmin();

  const { count: totalArticles } = await db
    .from('persona_memory')
    .select('*', { count: 'exact', head: true })
    .eq('persona_id', PERSONA_ID)
    .in('memory_type', ['article', 'context']);

  if ((totalArticles ?? 0) === 0) return { type: 'bootstrap' };

  const dow = new Date().getDay(); // 0=Sun

  // Sunday with no articles this week → weekly narrative map
  if (dow === 0) {
    const { count: weekArticles } = await db
      .from('persona_memory')
      .select('*', { count: 'exact', head: true })
      .eq('persona_id', PERSONA_ID)
      .eq('memory_type', 'article')
      .gte('created_at', getWeekStart());
    if ((weekArticles ?? 0) === 0) return { type: 'weekly_narrative_map' };
  }

  // Default: always update tracker on silent days (no LLM needed)
  return { type: 'update_tracker_only' };
}

// ── Executor ──────────────────────────────────────────────────────────────────

export async function executeSelfWork(
  task:      SelfWorkTask,
  data:      LeoDataPull,
  narratives: NarrativeState[],
  context:   string
): Promise<SelfWorkResult> {

  // update_tracker_only never generates an article
  if (task.type === 'update_tracker_only') {
    const updates = await updateNarrativeTracker(data.trendingCoins);
    return {
      wrote:           false,
      type:            'update_tracker_only',
      reasoning:       `Tracker updated: +${updates.added.length} new, ${updates.advanced.length} stage changes, ${updates.faded.length} fading`,
      trackerUpdates:  updates,
    };
  }

  // Article-generating self-work
  let article: PublishableArticle;
  if (task.type === 'bootstrap') {
    article = await generateBootstrap(data, narratives);
  } else {
    article = await generateWeeklyNarrativeMap(data, narratives, context);

    // Victor pre-publish review for weekly_narrative_map
    const db = supabaseAdmin();
    const { data: directives } = await db.from('editorial_directives')
      .select('directive')
      .eq('persona_id', PERSONA_ID)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);
    const activeDirective = directives?.[0]?.directive ?? null;

    const victorDecision = await victorPrePublishReview({
      article: article as DeskArticle,
      personaId: PERSONA_ID,
      activeDirective,
      generationType: 'self_work',
    });

    if (victorDecision.decision === 'block') {
      const updates = await updateNarrativeTracker(data.trendingCoins);
      return {
        wrote: false,
        type: task.type,
        reasoning: `Victor blocked: ${victorDecision.reason}`,
        trackerUpdates: updates,
      };
    }

    if (victorDecision.decision === 'edit' && victorDecision.edit_instruction) {
      article = await applyVictorEdit(article as DeskArticle, PERSONA_ID, victorDecision.edit_instruction) as PublishableArticle;
    }
  }

  const { slug, id } = await publishArticleToSanity(article, PERSONA_ID);

  // Store in memory
  const db = supabaseAdmin();
  const memType = task.type === 'bootstrap' ? 'context' : 'article';
  const { data: memRow } = await db.from('persona_memory').insert({
    persona_id:  PERSONA_ID,
    memory_type: memType,
    content:     `${article.title}\n\n${article.excerpt}`,
    metadata: { slug, title: article.title, topic: task.type, sanity_id: id, self_work: true },
  }).select('id').single();

  if (memRow?.id) void saveEmbedding(memRow.id, `${article.title}\n\n${article.excerpt}`);

  // Also update narrative tracker
  const updates = await updateNarrativeTracker(data.trendingCoins);

  return {
    wrote:           true,
    type:            task.type,
    articleSlug:     slug,
    articleCategory: article.category,
    reasoning:       `Self-work: ${task.type}`,
    trackerUpdates:  updates,
  };
}

// ── Generators ────────────────────────────────────────────────────────────────

async function generateBootstrap(data: LeoDataPull, narratives: NarrativeState[]): Promise<PublishableArticle> {
  const activeNarratives = narratives.filter((n) => n.currentStage !== 'dead');

  const prompt = `You are Leo Cruz, narrative analyst at finc.news. This is your first article.

Write a perspective piece that establishes your narrative-hunting framework. Do NOT open with
"Hi I'm Leo" — open with the analytical point. Your background emerges naturally through the argument.

WHAT THIS ARTICLE MUST ESTABLISH:
1. Your core thesis: price follows narrative, narrative follows attention, attention is measurable
2. Your background: entered DeFi Summer 2020, traded narratives not tokens, learned the hard way
3. Current market narrative snapshot using today's data
4. Your framework: how to spot narratives early (social data, trending, Reddit buzz, cycle stages)
5. What you'll be tracking and writing about — set expectations without being meta about it

TODAY'S NARRATIVE SNAPSHOT:
- Fear & Greed: ${data.fearGreedCurrent}/100 (${data.fearGreedDelta7d > 0 ? '+' : ''}${data.fearGreedDelta7d} vs 7d ago)
- Trending: ${data.trendingCoins.slice(0, 5).map((c) => `${c.name}`).join(', ')}
- Active narratives being tracked: ${activeNarratives.length > 0 ? activeNarratives.map((n) => `${n.narrative} (${n.currentStage})`).join(', ') : 'none yet — starting fresh'}

TONE: This is a manifesto, not an introduction. Start with an argument.
LENGTH: ~500 words
CATEGORY: crypto

Return ONLY valid JSON:
{
  "title": "thesis-driven title, not a list or intro",
  "excerpt": "2-3 sentences stating Leo's position (max 220 chars)",
  "body": "full article in markdown, use ## headers, ~500 words",
  "metaTitle": "max 60 chars",
  "metaDescription": "max 155 chars",
  "tags": ["narratives", "crypto-market", "sentiment"],
  "category": "crypto",
  "telegramText": "5-7 lines. Lead with the thesis. End with {URL}"
}`;

  const res = await callClaude({
    model: 'claude-sonnet-4-5', max_tokens: 2600,
    messages: [{ role: 'user', content: prompt }],
  });
  return parseClaudeJson<PublishableArticle>(res);
}

async function generateWeeklyNarrativeMap(
  data:      LeoDataPull,
  narratives: NarrativeState[],
  context:   string
): Promise<PublishableArticle> {
  const active  = narratives.filter((n) => n.currentStage !== 'dead');
  const fading  = active.filter((n) => n.currentStage === 'fading');
  const growing = active.filter((n) => n.currentStage === 'growing' || n.currentStage === 'peak');
  const emerging = active.filter((n) => n.currentStage === 'emerging');

  const dateRange = getWeekDateRange();

  const prompt = `You are Leo Cruz, narrative analyst at finc.news.

Write a weekly narrative map for the week of ${dateRange}.

STRUCTURE:
- Opening: one sentence on where market narrative energy sits right now
- What's growing: narratives with momentum
- What's fading: narratives cooling down
- What's emerging: new signals to watch
- The one theme to keep an eye on this week
- Under 400 words

NARRATIVE TRACKER STATUS:
Growing/Peak: ${growing.map((n) => n.narrative).join(', ') || 'none'}
Fading: ${fading.map((n) => n.narrative).join(', ') || 'none'}
Emerging: ${emerging.map((n) => n.narrative).join(', ') || 'none'}
Trending right now: ${data.trendingCoins.slice(0, 5).map((c) => c.name).join(', ')}

SENTIMENT:
- Fear & Greed: ${data.fearGreedCurrent}/100

YOUR RECENT ARTICLES:
${context || 'None yet'}

Return ONLY valid JSON:
{
  "title": "Narrative Map: ${dateRange}",
  "excerpt": "Weekly narrative roundup (max 200 chars)",
  "body": "full article in markdown",
  "metaTitle": "Crypto Narrative Map: ${dateRange} | FinCNews",
  "metaDescription": "Leo Cruz weekly narrative map — what's trending, fading, and emerging in crypto",
  "tags": ["narratives", "weekly-map", "sentiment"],
  "category": "crypto",
  "telegramText": "5-6 lines. Key narrative moves. End with {URL}"
}`;

  const res = await callClaude({
    model: 'claude-haiku-4-5-20251001', max_tokens: 1600,
    messages: [{ role: 'user', content: prompt }],
  });
  return parseClaudeJson<PublishableArticle>(res);
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function getWeekDateRange(): string {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(mon)}–${fmt(sun)}`;
}
