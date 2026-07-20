import type { LeoDataPull, TrendingCoin } from './data-pull';
import type { NarrativeState } from './narratives';

export type SignalType =
  | 'new_trending'
  | 'sentiment_shift'
  | 'rotation'
  | 'fading_narrative'
  | 'volume_spike'
  | 'reddit_buzz';

export interface Signal {
  type:        SignalType;
  strength:    number;      // 0-100
  token?:      string;
  narrative?:  string;
  delta?:      number;
  description: string;
}

// ── Detectors ─────────────────────────────────────────────────────────────────

function detectNewTrending(
  trendingCoins: TrendingCoin[],
  narratives: NarrativeState[],
  prevCoins?: Array<{ id: string; score: number }>
): Signal[] {
  const trackedNames = new Set(narratives.map((n) => n.narrative.toLowerCase()));
  const prevMap = new Map(prevCoins?.map((c) => [c.id, c.score]) ?? []);

  return trendingCoins
    .filter((c) => !trackedNames.has(c.name.toLowerCase()) && !trackedNames.has(c.symbol.toLowerCase()))
    .slice(0, 3)
    .map((c) => {
      const prevScore = prevMap.get(c.id);
      const rankDelta = prevScore !== undefined ? prevScore - c.score : null; // positive = improved rank
      const deltaNote = rankDelta !== null
        ? ` (rank ${rankDelta > 0 ? `+${rankDelta}` : String(rankDelta)} vs last run)`
        : '';
      return {
        type:        'new_trending' as SignalType,
        strength:    Math.max(40, 80 - c.score * 8),
        token:       c.symbol,
        narrative:   c.name,
        delta:       rankDelta ?? undefined,
        description: `${c.name} (${c.symbol}) is new in CoinGecko trending top-7 — not tracked before${deltaNote}`,
      };
    });
}

function detectSentimentShift(
  fearGreedCurrent: number,
  fearGreedDelta7d: number
): Signal[] {
  const absDelta = Math.abs(fearGreedDelta7d);
  if (absDelta < 15) return [];
  return [{
    type:        'sentiment_shift',
    strength:    Math.min(90, 50 + absDelta),
    delta:       fearGreedDelta7d,
    description: `Fear & Greed shifted ${fearGreedDelta7d > 0 ? '+' : ''}${fearGreedDelta7d} pts in 7 days (now ${fearGreedCurrent})`,
  }];
}

function detectFadingNarratives(
  trendingCoins: TrendingCoin[],
  narratives: NarrativeState[]
): Signal[] {
  const currentIds = new Set(trendingCoins.map((c) => c.id.toLowerCase()));
  const currentNames = new Set(trendingCoins.map((c) => c.name.toLowerCase()));

  return narratives
    .filter((n) =>
      (n.currentStage === 'growing' || n.currentStage === 'peak') &&
      !currentIds.has(n.narrative.toLowerCase()) &&
      !currentNames.has(n.narrative.toLowerCase())
    )
    .map((n) => ({
      type:        'fading_narrative' as SignalType,
      strength:    n.currentStage === 'peak' ? 75 : 60,
      narrative:   n.narrative,
      description: `${n.narrative} was ${n.currentStage} but no longer in CoinGecko trending — narrative cooling`,
    }));
}

function detectRotation(
  fadingSignals: Signal[],
  newTrendingSignals: Signal[]
): Signal[] {
  if (fadingSignals.length === 0 || newTrendingSignals.length === 0) return [];
  const fading  = fadingSignals[0];
  const emerging = newTrendingSignals[0];
  return [{
    type:        'rotation',
    strength:    85,
    narrative:   `${fading.narrative ?? 'Previous'} → ${emerging.narrative ?? emerging.token ?? 'New'}`,
    description: `Rotation signal: ${fading.narrative ?? 'fading narrative'} cooling while ${emerging.token ?? emerging.narrative} enters trending`,
  }];
}

function detectRedditBuzz(hotPosts: LeoDataPull['hotPosts'], trendingCoins: TrendingCoin[]): Signal[] {
  const signals: Signal[] = [];
  const coinNames = trendingCoins.map((c) => c.name.toLowerCase());

  const titleText = hotPosts.map((p) => p.title.toLowerCase()).join(' ');

  for (const coin of trendingCoins) {
    const mentions = hotPosts.filter((p) =>
      p.title.toLowerCase().includes(coin.name.toLowerCase()) ||
      p.title.toLowerCase().includes(coin.symbol.toLowerCase())
    ).length;

    if (mentions >= 3) {
      signals.push({
        type:        'reddit_buzz',
        strength:    Math.min(70, 40 + mentions * 5),
        token:       coin.symbol,
        narrative:   coin.name,
        description: `${coin.name} mentioned in ${mentions} Reddit hot posts`,
      });
    }
  }

  void coinNames; void titleText;
  return signals.slice(0, 2);
}

// ── Main detector ─────────────────────────────────────────────────────────────

export function detectSignals(
  data:      LeoDataPull,
  narratives: NarrativeState[],
  prevCoins?: Array<{ id: string; score: number }>
): Signal[] {
  const newTrending  = detectNewTrending(data.trendingCoins, narratives, prevCoins);
  const sentShift    = detectSentimentShift(data.fearGreedCurrent, data.fearGreedDelta7d);
  const fading       = detectFadingNarratives(data.trendingCoins, narratives);
  const rotation     = detectRotation(fading, newTrending);
  const redditBuzz   = detectRedditBuzz(data.hotPosts, data.trendingCoins);

  // Rotation is strongest — put first
  return [...rotation, ...sentShift, ...newTrending, ...fading, ...redditBuzz]
    .sort((a, b) => b.strength - a.strength);
}
