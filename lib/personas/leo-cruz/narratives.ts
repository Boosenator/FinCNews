import { supabaseAdmin } from '@/lib/supabase';
import type { TrendingCoin } from './data-pull';

const PERSONA_ID = 'leo-cruz';

export type NarrativeCycleStage = 'emerging' | 'growing' | 'peak' | 'fading' | 'dead';

export interface NarrativeState {
  narrative:       string;
  currentStage:    NarrativeCycleStage;
  firstDetected:   string;   // ISO date
  lastUpdated:     string;
  trendScores:     number[]; // last 14 days (1-100, higher = more trending)
  articlesWritten: string[]; // slugs
  peakScore:       number;
}

// ── Load / Save ───────────────────────────────────────────────────────────────

export async function loadNarrativeHistory(): Promise<NarrativeState[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('persona_memory')
    .select('metadata')
    .eq('persona_id', PERSONA_ID)
    .eq('memory_type', 'narrative')
    .neq('metadata->>currentStage', 'dead');

  return (data ?? []).map((r) => r.metadata as unknown as NarrativeState);
}

export async function saveNarrativeState(state: NarrativeState): Promise<void> {
  const db = supabaseAdmin();

  // Upsert by narrative name
  const { data: existing } = await db
    .from('persona_memory')
    .select('id')
    .eq('persona_id', PERSONA_ID)
    .eq('memory_type', 'narrative')
    .eq('metadata->>narrative' as 'metadata', state.narrative)
    .single();

  const content = `Narrative: ${state.narrative} | Stage: ${state.currentStage} | Since: ${state.firstDetected}`;

  if (existing?.id) {
    await db
      .from('persona_memory')
      .update({ content, metadata: state as unknown as Record<string, unknown> })
      .eq('id', existing.id);
  } else {
    await db.from('persona_memory').insert({
      persona_id:  PERSONA_ID,
      memory_type: 'narrative',
      content,
      metadata:    state as unknown as Record<string, unknown>,
    });
  }
}

// ── Tracker update (no LLM — runs every day) ─────────────────────────────────

export async function updateNarrativeTracker(trendingCoins: TrendingCoin[]): Promise<{
  added: string[];
  advanced: string[];
  faded: string[];
}> {
  const existing = await loadNarrativeHistory();
  const now = new Date().toISOString();
  const trendingIds   = new Set(trendingCoins.map((c) => c.id.toLowerCase()));
  const trendingNames = new Set(trendingCoins.map((c) => c.name.toLowerCase()));

  const added:    string[] = [];
  const advanced: string[] = [];
  const faded:    string[] = [];

  // Update existing narratives
  for (const n of existing) {
    const inTrending = trendingIds.has(n.narrative.toLowerCase()) ||
                       trendingNames.has(n.narrative.toLowerCase());

    const daysSinceFirst = (Date.now() - new Date(n.firstDetected).getTime()) / 86_400_000;
    const prevStage = n.currentStage;

    let newStage: NarrativeCycleStage = n.currentStage;

    const score = inTrending
      ? Math.max(10, 100 - (trendingCoins.find((c) =>
          c.name.toLowerCase() === n.narrative.toLowerCase())?.score ?? 7) * 10)
      : 0;

    // Rolling 3-day average for smoother transitions
    const recentHistory = [...n.trendScores.slice(-2), score];
    const recentAvg     = recentHistory.reduce((a, b) => a + b, 0) / recentHistory.length;
    const peakRatio     = n.peakScore > 0 ? recentAvg / n.peakScore : 1;

    if (inTrending) {
      if (daysSinceFirst < 3) {
        newStage = 'emerging';
      } else if (daysSinceFirst < 7) {
        // Started declining from peak while still in trending → peak
        newStage = peakRatio < 0.55 ? 'peak' : 'growing';
      } else {
        // 7+ days: near historical max → peak, declining → fading
        newStage = peakRatio >= 0.65 ? 'peak' : 'fading';
      }
    } else {
      // Not in trending — use peakScore ratio for decay speed
      if (n.currentStage === 'emerging') {
        newStage = 'dead';
      } else if (n.currentStage === 'growing') {
        newStage = 'fading';
      } else if (n.currentStage === 'peak') {
        newStage = 'fading';
      } else if (n.currentStage === 'fading') {
        // Dead only when well below peak (not just a 1-day dip)
        newStage = peakRatio < 0.12 ? 'dead' : 'fading';
      }
    }

    const updated: NarrativeState = {
      ...n,
      currentStage: newStage,
      lastUpdated:  now,
      trendScores:  [...n.trendScores.slice(-13), score], // keep last 14
      peakScore:    Math.max(n.peakScore, score),
    };

    await saveNarrativeState(updated);
    if (newStage !== prevStage) {
      if (newStage === 'fading' || newStage === 'dead') faded.push(n.narrative);
      else advanced.push(n.narrative);
    }
  }

  // Add newly trending coins not yet tracked
  const existingNames = new Set(existing.map((n) => n.narrative.toLowerCase()));
  for (const coin of trendingCoins) {
    if (!existingNames.has(coin.name.toLowerCase())) {
      const score = Math.max(10, 100 - coin.score * 10);
      const state: NarrativeState = {
        narrative:       coin.name,
        currentStage:    'emerging',
        firstDetected:   now,
        lastUpdated:     now,
        trendScores:     [score],
        articlesWritten: [],
        peakScore:       score,
      };
      await saveNarrativeState(state);
      added.push(coin.name);
    }
  }

  return { added, advanced, faded };
}

// Called after Leo publishes an article about a narrative
export async function markNarrativeCovered(narrative: string, articleSlug: string): Promise<void> {
  const histories = await loadNarrativeHistory();
  const found = histories.find((n) => n.narrative.toLowerCase() === narrative.toLowerCase());
  if (!found) return;

  await saveNarrativeState({
    ...found,
    lastUpdated:     new Date().toISOString(),
    articlesWritten: [...found.articlesWritten, articleSlug],
  });
}
