import { callClaude, parseClaudeJson } from '@/lib/personas/shared';
import type { CollectedData, AnalystContext } from './data-collector';
import type { PatternAlert } from './patterns';

const PERSONA_LABELS: Record<string, string> = {
  'elena-voss':  'Elena Voss (macro bear, TradFi, Fed/rates/DXY)',
  'marcus-webb': 'Marcus Webb (on-chain z-score anomalies, Bloomberg terminal voice)',
  'leo-cruz':    'Leo Cruz (narrative hunter, social signals, retail psychology)',
};

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

function buildArticleBlock(ctx: AnalystContext): string {
  const label = PERSONA_LABELS[ctx.personaId] ?? ctx.personaId;
  if (!ctx.todayArticle) return `${label}: [did not publish today]`;

  const a = ctx.todayArticle;
  const history = ctx.last5Articles
    .map((h, i) => `  ${i + 1}. "${h.title}" (${h.publishedAt.slice(0, 10)})`)
    .join('\n');

  const forecasts = ctx.openForecasts.length > 0
    ? ctx.openForecasts.slice(0, 3).join('\n  ')
    : 'none';

  const prevFeedback = ctx.recentFeedback.length > 0
    ? ctx.recentFeedback.join('\n  ')
    : 'none yet';

  const directives = ctx.directives.length > 0
    ? ctx.directives.join('\n  ')
    : 'none given';

  return `── ${label} ──
TODAY'S ARTICLE:
  Title:    "${a.title}"
  Excerpt:  "${a.excerpt}"
  Body preview: "${a.body.slice(0, 500)}..."
  Category: ${a.category}

RECENT HISTORY (last 5 articles):
${history || '  (none)'}

OPEN FORECASTS:
  ${forecasts}

YOUR PREVIOUS FEEDBACK TO THIS ANALYST:
  ${prevFeedback}

ACTIVE DIRECTIVES YOU GAVE:
  ${directives}`;
}

export async function evaluate(data: CollectedData, alerts: PatternAlert[]): Promise<EditorialSession> {
  const publishedAnalysts = data.analysts.filter((a) => a.todayArticle !== null);

  const articleBlocks = data.analysts.map(buildArticleBlock).join('\n\n');

  const alertBlock = alerts.length > 0
    ? alerts.map((a) => `- ${PERSONA_LABELS[a.personaId] ?? a.personaId}: ${a.warning}`).join('\n')
    : 'No pattern alerts today.';

  const prompt = `You are Victor Kane, Chief Editor of finc.news.
20 years in financial journalism — Reuters, Bloomberg Opinion.

YOUR ANALYSTS:
- Marcus Webb: on-chain z-score anomalies, Bloomberg terminal voice, data-only, dry
- Elena Voss: macro bear, TradFi perspective, Fed/rates/DXY, academic but precise
- Leo Cruz: narrative hunter, social signals, retail psychology, hook-driven

YOUR JOB TODAY:
Evaluate articles published today. Give direct, actionable feedback.
Not a summary of what they wrote — feedback on HOW they wrote it and HOW to improve.

SCORING RUBRIC (20 points each = 100 total):
1. Thesis clarity: one clear, specific, arguable point?
2. Data specificity: named metrics with actual values, source cited?
3. Voice consistency: sounds like THIS analyst, not generic content?
4. Signal value: actionable/novel for the reader?
5. Conclusion strength: closes with specific watch/signal/position (not a question)?

FEEDBACK RULES:
- Be direct: "Conclusion is weak" NOT "could be stronger"
- Reference specific sentences or words, not general impressions
- ONE priority fix per article — the single most important thing
- Note ONE strength — what worked, what to repeat
- Max 150 words total per analyst
- Pattern warnings are already detected — reference them directly if given

TODAY'S CONTENT:
${articleBlocks}

PATTERN ALERTS:
${alertBlock}

For analysts who did NOT publish today: set published_today=false, score=null, leave other fields empty.

Return ONLY valid JSON:
{
  "date": "${data.date}",
  "editorial_session": {
    "elena-voss":  { "published_today": bool, "score": null|0-100, "strengths": ["max 2"], "priority_fix": "one specific thing", "directive": "instruction for next article", "pattern_warning": null|"string" },
    "marcus-webb": { ... },
    "leo-cruz":    { ... }
  },
  "desk_note": "1-2 sentences about the desk today — overall quality, trends, what to watch"
}`;

  const res = await callClaude({
    model:      'claude-sonnet-4-5',
    max_tokens: 1800,
    messages:   [{ role: 'user', content: prompt }],
  });

  const result = await parseClaudeJson<EditorialSession>(res);

  // Ensure all analysts are present, mark non-publishers
  for (const ctx of data.analysts) {
    if (!result.editorial_session[ctx.personaId]) {
      result.editorial_session[ctx.personaId] = ctx.todayArticle
        ? { published_today: true, score: 70, strengths: [], priority_fix: 'N/A', directive: '', pattern_warning: null }
        : null;
    }
  }

  void publishedAnalysts; // used for context, explicit to avoid lint
  return result;
}
