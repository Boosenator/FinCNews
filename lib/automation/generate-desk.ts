import { callClaude, parseClaudeJson, PERSONA_NAME } from '@/lib/personas/shared';
import { supabaseAdmin } from '@/lib/supabase';

// ── Persona system prompts (RSS-adapted voice) ────────────────────────────────

const PERSONA_SYSTEM: Record<string, string> = {
  'elena-voss': `You are Elena Voss, macro analyst at finc.news.
12 years in traditional finance (fixed income Deutsche Bank, macro at European family office). You came to crypto in 2021 through a client allocation — you remain skeptical of the timeline, not of the asset.

CORE BELIEF: BTC is a risk asset. Macro context IS the crypto trade.

WHEN COVERING NEWS: Frame everything through the macro lens — rate cycle, DXY, credit conditions, Fed policy. Even protocol news gets the TradFi treatment. Connect the news event to the broader macro environment with precision.

VOICE RULES:
- Open with the macro context or data point — precise number or exact quote
- Cite economic calendar dates in conclusion ("Watch: [date] — [event]")
- Use: "However", "Notably", "This matters because", "Historically"
- Never: "moon", "ape in", speculation beyond data
- When uncertain: "the data doesn't resolve this yet"
- Max 500 words, markdown headers

EDITORIAL DIRECTIVE is injected in context — treat as direct instruction.`,

  'marcus-webb': `You are Marcus Webb, on-chain data analyst at finc.news.
8 years institutional finance, 6 years crypto. 4 years hedge fund on-chain surveillance. You crossed into crypto because the data was more honest than equity markets. You never guess.

CORE BELIEF: Markets are flows. Everything leaves an on-chain trace.

WHEN COVERING NEWS: Interpret events through the on-chain lens. Cite what exchange data, miner behavior, or network metrics would likely show in this scenario — reference historical precedents with specific values. If real-time data isn't available, cite the pattern context.

VOICE RULES:
- Open with a specific metric, value, and its deviation from norm
- Second paragraph: last time this happened (date, price context, what followed)
- Third paragraph: corroborating signal (exchange flows, mempool, dominance)
- Close: "What to watch: if [metric] [crosses] [threshold], [implication]"
- Always cite source inline: "(CoinGlass)", "(mempool.space)", "(Glassnode)"
- Never: "could", "might", "bullish", "bearish", "interesting", "exciting"
- Max 400 words, Bloomberg terminal voice

EDITORIAL DIRECTIVE is injected in context — treat as direct instruction.`,

  'leo-cruz': `You are Leo Cruz, narrative analyst at finc.news.
Former Reddit mod turned crypto analyst. You understand how retail thinks — the memes, the cycles, the FOMO. You are the desk's cultural translator.

CORE BELIEF: Price follows narrative. Find the story shift, find the trade.

WHEN COVERING NEWS: Zoom in on sentiment dynamics and narrative implications. How will the market interpret this emotionally? What belief does this event confirm or shatter? Where does the current narrative break?

VOICE RULES:
- Open with a hook — the narrative angle, not the headline fact
- Second paragraph: what retail/social data shows about current sentiment
- Third paragraph: historical narrative precedent — when did this story play before?
- Close: "The signal to watch: [narrative trigger that would confirm/deny the shift]"
- Use: sharp observations, cultural references, specific sentiment data when available
- Never: purely technical analysis, dry data reporting
- Max 450 words, conversational but sharp

EDITORIAL DIRECTIVE is injected in context — treat as direct instruction.`,
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type DeskArticle = {
  title:           string;
  excerpt:         string;
  body:            string;
  metaTitle:       string;
  metaDescription: string;
  tags:            string[];
  category:        string;
  telegramText:    string;
};

export type VictorDecision = {
  decision:           'approve' | 'edit' | 'block';
  edit_instruction:   string | null;
  reason:             string;
  directive_followed: boolean;
};

export type DeskGenerateResult = {
  article:        DeskArticle;
  victorDecision: VictorDecision;
  steps:          Array<{ name: string; status: 'ok' | 'error' | 'skip'; durationMs: number; note?: string }>;
};

type PersonaContext = {
  recentArticles:  string;
  activeDirective: string | null;
};

// ── Load persona context from DB ──────────────────────────────────────────────

async function loadPersonaContext(personaId: string): Promise<PersonaContext> {
  const db = supabaseAdmin();

  const [{ data: memories }, { data: directives }] = await Promise.all([
    db.from('persona_memory')
      .select('content, metadata')
      .eq('persona_id', personaId)
      .eq('memory_type', 'article')
      .order('created_at', { ascending: false })
      .limit(5),
    db.from('editorial_directives')
      .select('directive')
      .eq('persona_id', personaId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  const recentArticles = (memories ?? [])
    .map((m, i) => {
      const meta = m.metadata as { title?: string; slug?: string; source?: string } | null;
      return `${i + 1}. "${meta?.title ?? m.content.slice(0, 80)}"${meta?.source === 'rss' ? ' [rss]' : ''}`;
    })
    .join('\n') || 'No prior articles.';

  const activeDirective = directives?.[0]?.directive ?? null;

  return { recentArticles, activeDirective };
}

// ── Step 7a: Angle discovery ──────────────────────────────────────────────────

async function discoverAngle(opts: {
  item:           { title: string; snippet: string };
  personaId:      string;
  recentArticles: string;
  articleType:    'new' | 'continuation';
  continuationOf: string | null;
}): Promise<string> {
  const personaName = PERSONA_NAME[opts.personaId] ?? opts.personaId;

  const prompt = `You are the editorial research assistant for finc.news.

TASK: Find the most interesting angle for ${personaName} to take on this story.

NEWS ITEM:
Title: "${opts.item.title}"
Snippet: "${opts.item.snippet}"

${opts.articleType === 'continuation' && opts.continuationOf
  ? `CONTINUATION OF: "${opts.continuationOf}" — this story continues a previous article. Find what's NEW.`
  : ''}

${personaName}'s RECENT ARTICLES (avoid repeating these angles):
${opts.recentArticles}

Respond with ONE sentence: the specific editorial angle ${personaName} should take.
Be concrete — name the exact lens, comparison, metric, or narrative hook.
Do NOT be generic ("cover the story"). Be specific.`;

  try {
    const res    = await callClaude({ model: 'claude-sonnet-4-6', max_tokens: 150, messages: [{ role: 'user', content: prompt }] });
    const json   = await res.json() as { content: { text: string }[] };
    return (json.content[0]?.text ?? '').trim();
  } catch {
    return `${personaName} analysis of: ${opts.item.title}`;
  }
}

// ── Step 7b: Draft generation ─────────────────────────────────────────────────

async function generateDraft(opts: {
  item:            { title: string; snippet: string; pubDate?: string };
  personaId:       string;
  category:        string;
  angle:           string;
  activeDirective: string | null;
  continuationOf:  string | null;
}): Promise<DeskArticle> {
  const system  = PERSONA_SYSTEM[opts.personaId] ?? PERSONA_SYSTEM['leo-cruz'];
  const date    = opts.item.pubDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  const directiveSection = opts.activeDirective
    ? `ACTIVE DIRECTIVE FROM CHIEF EDITOR (apply in this article):
"${opts.activeDirective}"
This is a standing instruction — execute it, do not ignore it.`
    : '';

  const continuationNote = opts.continuationOf
    ? `CONTINUATION: This is a follow-up to your previous article "${opts.continuationOf}". Reference it explicitly ("Earlier we reported that...") and focus on what is NEW.`
    : '';

  const userPrompt = `NEWS SOURCE:
Title: ${opts.item.title}
Date: ${date}
Category: ${opts.category}
Content: ${opts.item.snippet}

EDITORIAL ANGLE (assigned by editors): ${opts.angle}

${continuationNote}

${directiveSection}

Write the article in your established voice. Use markdown ## headers.
Structure: ## What Happened / ## Key Details / ## Why It Matters / ## What Happens Next

Return ONLY valid JSON:
{
  "title": "SEO title, 50-70 chars, fact-specific",
  "excerpt": "120-220 chars, core event + why it matters",
  "body": "full article markdown, use ## headers",
  "metaTitle": "50-60 chars SEO",
  "metaDescription": "140-160 chars",
  "tags": ["3-5 relevant tags"],
  "category": "${opts.category}",
  "telegramText": "3-5 lines, numbers first, end with {URL}"
}`;

  const res    = await callClaude({ model: 'claude-sonnet-4-6', max_tokens: 2400, system, messages: [{ role: 'user', content: userPrompt }] });
  return parseClaudeJson<DeskArticle>(res);
}

// ── Step 7c: Critique (self-review) ──────────────────────────────────────────

async function critiqueAndFix(draft: DeskArticle, personaId: string): Promise<DeskArticle> {
  const personaName = PERSONA_NAME[personaId] ?? personaId;

  const prompt = `You are a senior editor reviewing an article by ${personaName} at finc.news.

DRAFT:
Title: "${draft.title}"
Excerpt: "${draft.excerpt}"
Body: "${draft.body.slice(0, 1200)}..."

Check for these issues (ONLY flag real problems — do not invent issues):
1. Conclusion is a question or vague ("we'll see") instead of a specific watch metric
2. Voice breaks — sounds generic, not like ${personaName}
3. Any numbers that appear fabricated (specific percentages, prices not in the source)
4. Title and excerpt don't match the body's actual angle

Return ONLY valid JSON:
{
  "approved": true | false,
  "issues": ["issue 1", "issue 2"] | [],
  "fix_instruction": null | "specific targeted fix in 1-2 sentences"
}`;

  try {
    const res     = await callClaude({ model: 'claude-sonnet-4-6', max_tokens: 300, messages: [{ role: 'user', content: prompt }] });
    const result  = await parseClaudeJson<{ approved: boolean; issues: string[]; fix_instruction: string | null }>(res);

    if (result.approved || !result.fix_instruction) return draft;

    // One targeted rewrite pass
    const system = PERSONA_SYSTEM[personaId] ?? PERSONA_SYSTEM['leo-cruz'];
    const fixPrompt = `You are ${personaName}. Rewrite this draft applying ONE specific fix.

CURRENT DRAFT:
${JSON.stringify(draft)}

FIX TO APPLY:
${result.fix_instruction}

Return the corrected article as valid JSON in the exact same format.`;

    const fixRes = await callClaude({ model: 'claude-sonnet-4-6', max_tokens: 2400, system, messages: [{ role: 'user', content: fixPrompt }] });
    return await parseClaudeJson<DeskArticle>(fixRes);
  } catch {
    return draft;
  }
}

// ── Step 8: Victor Kane pre-publish review ────────────────────────────────────

async function victorPrePublishReview(opts: {
  article:         DeskArticle;
  personaId:       string;
  activeDirective: string | null;
  generationType:  'rss' | 'continuation';
}): Promise<VictorDecision> {
  const personaName = PERSONA_NAME[opts.personaId] ?? opts.personaId;

  const prompt = `You are Victor Kane, Chief Editor of finc.news.
20 years financial journalism — Reuters, Bloomberg Opinion. You manage AI analyst agents.

PRE-PUBLICATION REVIEW

ARTICLE:
Title: "${opts.article.title}"
Excerpt: "${opts.article.excerpt}"
Body: "${opts.article.body.slice(0, 900)}..."

AUTHOR: ${personaName}
TYPE: ${opts.generationType === 'continuation' ? 'Continuation of previous story' : 'New RSS article'}

ACTIVE DIRECTIVE FOR ${personaName.toUpperCase()}:
${opts.activeDirective ?? 'None currently active'}

YOUR DECISION:
Approve this for immediate publication, request ONE specific edit, or block it.

block ONLY if: fabricated numbers/facts not in source material, or obvious duplicate.
edit for: directive not followed, voice breaks, weak conclusion, missing critical context.
approve if: ready to publish as-is.

Return ONLY valid JSON:
{
  "decision": "approve" | "edit" | "block",
  "edit_instruction": null | "ONE specific instruction, max 2 sentences",
  "reason": "one sentence",
  "directive_followed": true | false
}`;

  try {
    const res = await callClaude({ model: 'claude-sonnet-4-6', max_tokens: 250, messages: [{ role: 'user', content: prompt }] });
    return await parseClaudeJson<VictorDecision>(res);
  } catch {
    return { decision: 'approve', edit_instruction: null, reason: 'Victor review failed — auto-approved', directive_followed: true };
  }
}

// ── Step 8b: Apply Victor's edit ──────────────────────────────────────────────

async function applyVictorEdit(article: DeskArticle, personaId: string, instruction: string): Promise<DeskArticle> {
  const system    = PERSONA_SYSTEM[personaId] ?? PERSONA_SYSTEM['leo-cruz'];
  const prompt    = `You are ${PERSONA_NAME[personaId] ?? personaId}. Your chief editor has one specific revision request.

CURRENT ARTICLE:
${JSON.stringify(article)}

CHIEF EDITOR INSTRUCTION:
"${instruction}"

Apply this exact change. Return the revised article as valid JSON in the same format.`;

  try {
    const res = await callClaude({ model: 'claude-sonnet-4-6', max_tokens: 2400, system, messages: [{ role: 'user', content: prompt }] });
    return await parseClaudeJson<DeskArticle>(res);
  } catch {
    return article;
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function generateDeskArticle(opts: {
  item: {
    title:    string;
    snippet:  string;
    url:      string;
    pubDate?: string | null;
  };
  personaId:      string;
  category:       string;
  articleType:    'new' | 'continuation';
  continuationOf: string | null;
}): Promise<DeskGenerateResult> {
  const steps: DeskGenerateResult['steps'] = [];
  const ctx     = await loadPersonaContext(opts.personaId);
  const genType: 'rss' | 'continuation' = opts.articleType === 'continuation' ? 'continuation' : 'rss';

  // 7a: Angle discovery
  let t = Date.now();
  const angle = await discoverAngle({
    item:           opts.item,
    personaId:      opts.personaId,
    recentArticles: ctx.recentArticles,
    articleType:    opts.articleType,
    continuationOf: opts.continuationOf,
  });
  steps.push({ name: 'angle_discovery', status: 'ok', durationMs: Date.now() - t, note: angle.slice(0, 80) });

  // 7b: Draft
  t = Date.now();
  let article = await generateDraft({
    item:            { title: opts.item.title, snippet: opts.item.snippet, pubDate: opts.item.pubDate ?? undefined },
    personaId:       opts.personaId,
    category:        opts.category,
    angle,
    activeDirective: ctx.activeDirective,
    continuationOf:  opts.continuationOf,
  });
  steps.push({ name: 'draft', status: 'ok', durationMs: Date.now() - t, note: `"${article.title.slice(0, 60)}"` });

  // 7c: Critique
  t = Date.now();
  const beforeCritique = article.title;
  article = await critiqueAndFix(article, opts.personaId);
  const critiqued = article.title !== beforeCritique;
  steps.push({ name: 'critique', status: 'ok', durationMs: Date.now() - t, note: critiqued ? 'revised' : 'approved as-is' });

  // 8: Victor pre-publish
  t = Date.now();
  let victorDecision = await victorPrePublishReview({
    article,
    personaId:       opts.personaId,
    activeDirective: ctx.activeDirective,
    generationType:  genType,
  });
  steps.push({ name: 'victor_review', status: 'ok', durationMs: Date.now() - t, note: `${victorDecision.decision}${victorDecision.edit_instruction ? ` — "${victorDecision.edit_instruction.slice(0, 60)}"` : ''}` });

  // 8b: Apply edit if requested
  if (victorDecision.decision === 'edit' && victorDecision.edit_instruction) {
    t = Date.now();
    article = await applyVictorEdit(article, opts.personaId, victorDecision.edit_instruction);
    victorDecision = { ...victorDecision, decision: 'approve' };
    steps.push({ name: 'victor_edit', status: 'ok', durationMs: Date.now() - t, note: 'applied' });
  }

  return { article, victorDecision, steps };
}
