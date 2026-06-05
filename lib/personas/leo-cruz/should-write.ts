import { callClaude, parseClaudeJson } from '@/lib/personas/shared';
import type { Signal } from './signals';
import type { NarrativeState } from './narratives';
import type { LeoDataPull } from './data-pull';

export interface ShouldWriteResult {
  should_write:    boolean;
  score:           number;
  reasoning:       string;
  topic:           string | null;
  narrative_type:  'emerging' | 'rotation' | 'peak_warning' | 'fading' | 'sentiment_shift' | null;
  cycle_stage:     'emerging' | 'growing' | 'peak' | 'fading' | null;
  primary_signals: string[];
}

export async function shouldWrite(
  signals:          Signal[],
  narratives:       NarrativeState[],
  data:             LeoDataPull,
  recentArticles:   string
): Promise<ShouldWriteResult> {
  if (signals.length === 0) {
    return {
      should_write:   false,
      score:          15,
      reasoning:      'No signals detected. Fear & Greed neutral, no new trending coins, no fading narratives.',
      topic:          null,
      narrative_type: null,
      cycle_stage:    null,
      primary_signals: [],
    };
  }

  const prompt = buildEvalPrompt(signals, narratives, data, recentArticles);

  const res = await callClaude({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages:   [{ role: 'user', content: prompt }],
  });

  try {
    return await parseClaudeJson<ShouldWriteResult>(res);
  } catch {
    // Fast fallback: if rotation signal present, write
    const hasRotation = signals.some((s) => s.type === 'rotation');
    return {
      should_write:    hasRotation,
      score:           hasRotation ? 75 : 20,
      reasoning:       'Parse error — fell back to signal check',
      topic:           signals[0]?.narrative ?? signals[0]?.token ?? null,
      narrative_type:  hasRotation ? 'rotation' : null,
      cycle_stage:     null,
      primary_signals: signals.slice(0, 2).map((s) => s.type),
    };
  }
}

function buildEvalPrompt(
  signals:        Signal[],
  narratives:     NarrativeState[],
  data:           LeoDataPull,
  recentArticles: string
): string {
  const activeNarratives = narratives
    .filter((n) => n.currentStage !== 'dead')
    .map((n) => `${n.narrative} [${n.currentStage}, ${n.articlesWritten.length} articles written]`)
    .join('\n  ');

  return `You are Leo Cruz's editorial judgment function.

Leo writes about: emerging crypto narratives, sentiment shifts, trending tokens, hype cycles, rotation plays, narrative deaths.
He does NOT write about on-chain data or Fed policy.
He DOES write when 2+ independent signals confirm a new narrative OR a major narrative is clearly dying.
He does NOT write when Fear & Greed is 40-60 with no spikes and nothing is trending unusually.

SIGNALS DETECTED TODAY (strongest first):
${signals.map((s) => `- [${s.type}] strength=${s.strength} — ${s.description}`).join('\n')}

CURRENT SENTIMENT:
- Fear & Greed: ${data.fearGreedCurrent}/100 (${data.fearGreedDelta7d > 0 ? '+' : ''}${data.fearGreedDelta7d} pts 7d change)
- Sentiment breakdown: ${
    data.sentimentBreakdown.positive + data.sentimentBreakdown.negative + data.sentimentBreakdown.neutral > 0
      ? `${data.sentimentBreakdown.positive} positive / ${data.sentimentBreakdown.negative} negative / ${data.sentimentBreakdown.neutral} neutral`
      : 'not available (CryptoPanic not configured)'
  }

TRENDING COINS: ${data.trendingCoins.map((c) => c.name).join(', ') || 'none'}

ACTIVE NARRATIVE TRACKER:
  ${activeNarratives || '(empty — no narratives tracked yet)'}

RECENT LEO ARTICLES (avoid repeating):
${recentArticles || 'None yet'}

Respond ONLY with valid JSON:
{
  "should_write": boolean,
  "score": number (0-100),
  "reasoning": "one sentence",
  "topic": "the narrative/token to write about, or null",
  "narrative_type": "emerging|rotation|peak_warning|fading|sentiment_shift or null",
  "cycle_stage": "emerging|growing|peak|fading or null",
  "primary_signals": ["signal_type1", "signal_type2"]
}

Score guide:
- Rotation (fading + new emerging): 80-90
- New narrative, 3+ signals confirming: 75-85
- Clear peak warning (overheated): 70-80
- Sentiment shift + trending confirmation: 65-75
- Single spike, unconfirmed: 40-55
- Neutral day (F&G 40-60, nothing new): 10-35`;
}
