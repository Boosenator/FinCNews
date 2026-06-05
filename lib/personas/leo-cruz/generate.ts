import { callClaude, parseClaudeJson, type PublishableArticle } from '@/lib/personas/shared';
import type { LeoDataPull } from './data-pull';
import type { Signal } from './signals';
import type { NarrativeState } from './narratives';
import type { ShouldWriteResult } from './should-write';

const SYSTEM_PROMPT = `You are Leo Cruz, narrative analyst at finc.news.

BACKGROUND:
Entered crypto in DeFi Summer 2020. Lost money, made money, lost money — until you realized
you weren't trading tokens, you were trading narratives. The token that moves first is the one
where the story is clearest, earliest. You've spent 5 years mapping how narratives form, peak,
and die in crypto.

CORE BELIEF:
Price follows narrative. Narrative follows attention. Attention is measurable.
You don't predict where BTC will be in 6 months — you tell people what story the market is
telling right now, and where that story is in its arc.

WRITING RULES:
1. Open with a hook — surprising fact, sharp question, or "remember when X? It's happening again"
2. Name the narrative clearly in paragraph 1 — don't make the reader guess
3. Show the data that proves the narrative is real, not just vibes
4. Identify where the narrative is in its cycle: emerging / growing / peak / fading
5. Write for someone with 2 minutes and a basic crypto understanding
6. Maximum 450 words
7. No technobabble without explanation
8. No price targets. No "this will 10x"
9. Light irony allowed. Sarcasm toward the reader is not.
10. Always close with one specific trigger that confirms OR kills the narrative

NEVER WRITE:
- Defensive disclaimers
- "Watch X" without your verdict on X
- Forward-looking meta about your writing
- Anything without data backing

VOICE TEST: Would someone share this with their group chat before the market opens? If no — rewrite the hook.`;

export async function generateLeoArticle(
  data:        LeoDataPull,
  signals:     Signal[],
  evalResult:  ShouldWriteResult,
  narratives:  NarrativeState[],
  context:     string
): Promise<PublishableArticle> {
  const topSignals = signals.slice(0, 4);

  const userPrompt = `TODAY'S SIGNALS:
${topSignals.map((s) => `- [${s.type}] ${s.description} (strength: ${s.strength})`).join('\n')}

SENTIMENT:
- Fear & Greed: ${data.fearGreedCurrent}/100 (${data.fearGreedDelta7d > 0 ? '+' : ''}${data.fearGreedDelta7d} vs 7 days ago)
- Sentiment: ${data.sentimentBreakdown.positive} positive / ${data.sentimentBreakdown.negative} negative stories
- Trending coins: ${data.trendingCoins.slice(0, 5).map((c) => `${c.name} (${c.symbol})`).join(', ')}

TOP REDDIT POSTS:
${data.hotPosts.slice(0, 5).map((p) => `- "${p.title}" (r/${p.subreddit}, ${p.score} pts)`).join('\n')}

YOUR NARRATIVE TRACKER (active):
${narratives.filter((n) => n.currentStage !== 'dead').map((n) =>
  `- ${n.narrative}: ${n.currentStage} (${n.articlesWritten.length} articles written)`
).join('\n') || '(empty — first run)'}

TODAY'S WRITE DECISION:
- Topic: ${evalResult.topic ?? 'general sentiment'}
- Narrative type: ${evalResult.narrative_type ?? 'unknown'}
- Cycle stage: ${evalResult.cycle_stage ?? 'unknown'}
- Reasoning: ${evalResult.reasoning}

YOUR CONTEXT (past articles + active narratives):
${context || 'No prior context yet — this is your first article.'}

Write the article. Return ONLY valid JSON:
{
  "title": "compelling hook-driven title, 60 chars max",
  "excerpt": "2-3 sentences that make a crypto-curious reader want to read (max 220 chars)",
  "body": "full article in markdown, use ## for headers, ~400-450 words",
  "metaTitle": "SEO title max 60 chars",
  "metaDescription": "SEO description max 155 chars",
  "tags": ["narrative", "token-name", "crypto"],
  "category": "one of: crypto|markets|economy|fintech|policy|companies",
  "telegramText": "5-7 tight lines. Lead with the signal. Numbers where possible. End with {URL}"
}`;

  const res = await callClaude({
    model:      'claude-sonnet-4-5',
    max_tokens: 2400,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: userPrompt }],
  });

  return parseClaudeJson<PublishableArticle>(res);
}
