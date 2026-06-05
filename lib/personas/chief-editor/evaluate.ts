import { callClaude, parseClaudeJson } from '@/lib/personas/shared';
import { embedText } from '@/lib/personas/embeddings';
import type { CollectedData, AnalystContext } from './data-collector';
import type { PatternAlert } from './patterns';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface PersonaFeedback {
  published_today:  boolean;
  score:            number | null;
  strengths:        string[];
  priority_fix:     string;
  directive:        string;
  pattern_warning:  string | null;
}

export interface EditorialSession {
  date:               string;
  editorial_session:  Record<string, PersonaFeedback | null>;
  desk_note:          string;
}

export interface OverlapPair {
  persona1:   string;
  persona2:   string;
  similarity: number;  // 0-1
  note:       string;
}

export interface OverlapReport {
  pairs:   OverlapPair[];
  summary: string;
}

const ANALYST_DESCRIPTIONS: Record<string, string> = {
  'elena-voss':  'Elena Voss — macro bear, TradFi perspective, Fed/rates/DXY, academic but precise',
  'marcus-webb': 'Marcus Webb — on-chain z-score anomalies, Bloomberg terminal voice, data-only, dry',
  'leo-cruz':    'Leo Cruz — narrative hunter, social signals, retail psychology, hook-driven',
};

// ── Step 1: Detect semantic overlap between articles (no LLM) ─────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] ** 2;
    magB += b[i] ** 2;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export async function detectOverlap(analysts: AnalystContext[]): Promise<OverlapReport> {
  const published = analysts.filter((a) => a.todayArticle !== null);
  if (published.length < 2) {
    return { pairs: [], summary: 'Only one analyst published today — no overlap to measure.' };
  }

  // Embed each article title + excerpt (graceful skip if no OPENAI_API_KEY)
  const embedded = await Promise.all(
    published.map(async (ctx) => ({
      personaId:  ctx.personaId,
      title:      ctx.todayArticle!.title,
      embedding:  await embedText(`${ctx.todayArticle!.title} ${ctx.todayArticle!.excerpt}`),
    }))
  );

  const pairs: OverlapPair[] = [];

  for (let i = 0; i < embedded.length; i++) {
    for (let j = i + 1; j < embedded.length; j++) {
      const a = embedded[i];
      const b = embedded[j];

      // Fallback without embeddings: flag as unknown
      if (!a.embedding || !b.embedding) {
        pairs.push({
          persona1:   a.personaId,
          persona2:   b.personaId,
          similarity: -1,
          note: `${a.personaId} and ${b.personaId} both published today (overlap unknown — no embeddings)`,
        });
        continue;
      }

      const sim = cosineSimilarity(a.embedding, b.embedding);
      if (sim >= 0.6) {
        pairs.push({
          persona1:   a.personaId,
          persona2:   b.personaId,
          similarity: parseFloat(sim.toFixed(2)),
          note: `${ANALYST_DESCRIPTIONS[a.personaId]?.split(' — ')[0]} and ${ANALYST_DESCRIPTIONS[b.personaId]?.split(' — ')[0]} articles show ${Math.round(sim * 100)}% semantic overlap — "${a.title}" / "${b.title}"`,
        });
      }
    }
  }

  const summary = pairs.length > 0
    ? `Topic overlap detected:\n${pairs.map((p) => `  - ${p.note}`).join('\n')}`
    : 'No significant topic overlap between published analysts today (similarity < 60%).';

  return { pairs, summary };
}

// ── Step 2: Evaluate single analyst (sonnet) ──────────────────────────────────

export async function evaluateAnalyst(
  ctx:          AnalystContext,
  overlap:      OverlapReport,
  editorMemory: string,
  patterns:     PatternAlert[]
): Promise<PersonaFeedback> {
  if (!ctx.todayArticle) {
    return { published_today: false, score: null, strengths: [], priority_fix: '', directive: '', pattern_warning: null };
  }

  const a = ctx.todayArticle;
  const analystDesc = ANALYST_DESCRIPTIONS[ctx.personaId] ?? ctx.personaId;

  // Filter overlap to pairs involving this analyst
  const relevantOverlap = overlap.pairs
    .filter((p) => p.persona1 === ctx.personaId || p.persona2 === ctx.personaId)
    .map((p) => `  - ${p.note}`)
    .join('\n');

  const history = ctx.last5Articles
    .map((h, i) => `  ${i + 1}. "${h.title}" (${h.publishedAt.slice(0, 10)})`)
    .join('\n');

  const prevFeedback = ctx.recentFeedback.length > 0
    ? ctx.recentFeedback.slice(0, 2).join('\n  ')
    : 'None yet';

  const activeDirectives = ctx.directives.length > 0
    ? ctx.directives.join('\n  ')
    : 'None active';

  const patternNotes = patterns.length > 0
    ? patterns.map((p) => `  ⚠ ${p.warning}`).join('\n')
    : 'None detected';

  const prompt = `You are Victor Kane, Chief Editor of finc.news.
20 years in financial journalism — Reuters, Bloomberg Opinion.
You are evaluating ONE analyst. Be precise and direct.

ANALYST: ${analystDesc}

TODAY'S ARTICLE:
  Title:   "${a.title}"
  Excerpt: "${a.excerpt}"
  Body:    "${a.body.slice(0, 700)}..."

RECENT HISTORY (last 5):
${history || '  (none yet)'}

YOUR PREVIOUS FEEDBACK TO THIS ANALYST:
  ${prevFeedback}

ACTIVE DIRECTIVES YOU GAVE:
  ${activeDirectives}

PATTERN ALERTS (pre-detected):
${patternNotes}

TOPIC OVERLAP WITH OTHER ANALYSTS TODAY:
${relevantOverlap || '  None — unique topic today.'}

YOUR OWN EDITORIAL MEMORY:
${editorMemory || '  (no prior context)'}

SCORING RUBRIC (20 pts each = 100):
1. Thesis clarity — one clear, arguable point?
2. Data specificity — named metrics + values, source cited?
3. Voice consistency — sounds like THIS analyst, not generic?
4. Signal value — actionable/novel for reader?
5. Conclusion strength — specific watch/threshold, not a question?

RULES:
- Direct: "Conclusion is weak" NOT "could be stronger"
- ONE priority fix — the most important thing
- ONE strength — what to repeat
- Max 120 words of reasoning total
- If overlap detected: comment on whether the angle differentiates enough

Return ONLY valid JSON:
{
  "published_today": true,
  "score": 0-100,
  "strengths": ["max 2 items"],
  "priority_fix": "one specific sentence",
  "directive": "instruction for next article",
  "pattern_warning": null or "pattern description"
}`;

  try {
    const res = await callClaude({
      model:      'claude-sonnet-4-5',
      max_tokens: 600,
      messages:   [{ role: 'user', content: prompt }],
    });
    const parsed = await parseClaudeJson<PersonaFeedback>(res);
    return { ...parsed, published_today: true };
  } catch {
    return {
      published_today: true,
      score: 70,
      strengths: ['Article published'],
      priority_fix: 'Evaluation failed — check logs',
      directive: '',
      pattern_warning: null,
    };
  }
}

// ── Step 3: Synthesize desk note (haiku) ──────────────────────────────────────

export async function synthesizeDeskNote(
  scorecards:  Record<string, PersonaFeedback | null>,
  overlap:     OverlapReport,
  date:        string
): Promise<EditorialSession> {
  const published = Object.entries(scorecards)
    .filter(([, f]) => f?.published_today)
    .map(([id, f]) => `${ANALYST_DESCRIPTIONS[id]?.split(' — ')[0] ?? id}: score ${f?.score ?? 'n/a'}, fix: "${f?.priority_fix}"`)
    .join('\n');

  const prompt = `You are Victor Kane, Chief Editor of finc.news.

THREE INDIVIDUAL EVALUATIONS (already done):
${published || '(no one published today)'}

TOPIC OVERLAP BETWEEN ANALYSTS:
${overlap.summary}

Write the desk note: 1-2 sentences about the DESK AS A WHOLE today.
Focus on: overall quality trend, cross-persona dynamics, what the desk needs as a product.
NOT about individual articles (those are in scorecards above).
Be direct and specific — not generic editorial praise.

Return ONLY valid JSON: { "desk_note": "1-2 sentences" }`;

  let deskNote = 'Session complete.';
  try {
    const res = await callClaude({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages:   [{ role: 'user', content: prompt }],
    });
    const parsed = await parseClaudeJson<{ desk_note: string }>(res);
    deskNote = parsed.desk_note ?? deskNote;
  } catch {
    // desk_note is best-effort
  }

  return {
    date,
    editorial_session: scorecards,
    desk_note:         deskNote,
  };
}

// ── Legacy: kept for backward compatibility if needed ─────────────────────────
// The old single-call evaluate() is replaced by the three-step flow above.
// Orchestration now lives in index.ts.

export async function evaluate(data: CollectedData, alerts: PatternAlert[]): Promise<EditorialSession> {
  // This function is preserved so existing callers don't break during migration.
  // New flow: use detectOverlap + evaluateAnalyst + synthesizeDeskNote directly.
  const overlap  = await detectOverlap(data.analysts);
  const memory   = ''; // caller should pass editor memory if needed

  const scorecards: Record<string, PersonaFeedback | null> = {};
  await Promise.all(
    data.analysts.map(async (ctx) => {
      const personaAlerts = alerts.filter((a) => a.personaId === ctx.personaId);
      scorecards[ctx.personaId] = await evaluateAnalyst(ctx, overlap, memory, personaAlerts);
    })
  );

  return synthesizeDeskNote(scorecards, overlap, data.date);
}
