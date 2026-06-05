import { callClaude, parseClaudeJson } from '@/lib/personas/shared';
import type { Anomaly } from './anomalies';
import { areCorrelated } from './anomalies';
import type { MarcusBaseline } from './baseline';

export interface ShouldWriteResult {
  should_write:    boolean;
  score:           number;
  reasoning:       string;
  topic:           string | null;
  primary_metric:  string | null;
  anomalies_used:  Anomaly[];
}

export async function shouldWrite(
  anomalies:      Anomaly[],
  baseline:       MarcusBaseline,
  recentArticles: string
): Promise<ShouldWriteResult> {
  // Fast path — deterministic pre-scoring (no LLM needed for silent days)
  const strong = anomalies.filter((a) => Math.abs(a.zScore) >= 1.8);

  if (strong.length === 0 || baseline.samples < 7) {
    return {
      should_write:   false,
      score:          baseline.samples < 7 ? 0 : 15,
      reasoning:      baseline.samples < 7
        ? `Baseline still accumulating (${baseline.samples}/7 samples needed)`
        : 'All metrics within 1.8σ of 30-day baseline. Routine session.',
      topic:          null,
      primary_metric: null,
      anomalies_used: [],
    };
  }

  // Check 72h dedup — if primary metric covered recently, cap score
  const primaryMetric = strong[0].metric;
  const coveredRecently = recentArticles.includes(primaryMetric);
  if (coveredRecently && strong.length < 2) {
    return {
      should_write:   false,
      score:          35,
      reasoning:      `${strong[0].label} anomaly detected but covered in last 72h. Score capped.`,
      topic:          null,
      primary_metric: primaryMetric,
      anomalies_used: strong,
    };
  }

  // Build base score
  const correlated = strong.length >= 2 && areCorrelated(strong[0], strong[1]);
  const baseScore  = strong.length >= 2 && correlated ? 82 : strong.length >= 2 ? 72 : 64;
  const finalScore = Math.min(95, baseScore + Math.floor(Math.abs(strong[0].zScore) - 1.8) * 5);

  // LLM for topic + reasoning
  const prompt = `You are Marcus Webb's editorial judgment function.

Marcus publishes ONLY when on-chain metrics show z-score ≥1.8 from 30-day mean AND topic not covered in 72h.

ANOMALIES DETECTED (sorted by strength):
${strong.map((a) => `- ${a.label} (${a.source}): z=${a.zScore} [${a.direction}] — ${a.context}`).join('\n')}

RECENT ARTICLES (last 72h):
${recentArticles || 'None'}

Pre-computed score: ${finalScore}/100
Correlated anomalies: ${correlated}

Confirm this score makes sense and provide:
- A single sentence reasoning
- The specific topic (e.g., "elevated exchange inflows + miner selling pressure")
- The primary metric driving this

Respond ONLY with valid JSON:
{
  "should_write": true,
  "score": ${finalScore},
  "reasoning": "one sentence",
  "topic": "specific anomaly combination",
  "primary_metric": "${primaryMetric}"
}`;

  try {
    const res = await callClaude({
      model: 'claude-haiku-4-5-20251001', max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });
    const parsed = await parseClaudeJson<ShouldWriteResult>(res);
    return { ...parsed, should_write: finalScore >= 60, score: finalScore, anomalies_used: strong };
  } catch {
    return {
      should_write:   finalScore >= 60,
      score:          finalScore,
      reasoning:      `${strong.length} anomalies detected. Primary: ${strong[0].label} (z=${strong[0].zScore})`,
      topic:          strong.map((a) => a.label).slice(0, 2).join(' + '),
      primary_metric: primaryMetric,
      anomalies_used: strong,
    };
  }
}
