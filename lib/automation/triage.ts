import { callClaude, parseClaudeJson } from '@/lib/personas/shared';

export type TriageResult = {
  persona:          'elena-voss' | 'marcus-webb' | 'leo-cruz';
  angle:            string;
  urgency:          'breaking' | 'standard';
  expires_at:       string;
  article_type:     'new' | 'continuation';
  continuation_of:  string | null;
  reasoning:        string;
};

export type TriageInput = {
  index:    number;
  title:    string;
  snippet:  string;
  category: string;
  score:    number;
};

export type CoverageItem = {
  title:      string;
  slug:       string;
  persona_id: string | null;
};

const PERSONA_DESCRIPTIONS = `- elena-voss: macro/Fed/rates/yields/DXY/ECB/regulatory frameworks/TradFi perspective/inflation/CPI
- marcus-webb: on-chain data/exchange flows/whale activity/mining/mempool/Glassnode/BTC flows/network metrics
- leo-cruz: narrative shifts/trending tokens/retail sentiment/social signals/market psychology/FOMO/FUD/hype cycles`;

export async function triageItems(
  items:          TriageInput[],
  recentCoverage: CoverageItem[],
): Promise<TriageResult[]> {
  if (!items.length) return [];

  const now         = new Date();
  const breakingExp = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();
  const standardExp = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();

  const itemLines = items
    .map((i) => `${i.index}. [score:${i.score}] "${i.title}" | ${i.snippet.slice(0, 150)}`)
    .join('\n');

  const coverageLines = recentCoverage.slice(0, 30)
    .map((c, i) => `${i + 1}. [${c.persona_id ?? 'unknown'}] "${c.title}" (slug: ${c.slug})`)
    .join('\n');

  const prompt = `You are the editorial triage system for finc.news financial news site.
Assign each RSS news item to the right persona and determine urgency.

PERSONAS:
${PERSONA_DESCRIPTIONS}

RECENT COVERAGE (last 14 days — check for continuations):
${coverageLines || 'None yet'}

NEWS ITEMS TO TRIAGE:
${itemLines}

For each item:
1. Assign the best-fit persona based on the topic
2. Write a specific angle this persona would take (not generic — one concrete sentence)
3. Set urgency: score ≥ 80 = "breaking", else "standard"
4. Set expires_at: breaking = "${breakingExp}", standard = "${standardExp}"
5. Detect if this is a CONTINUATION of recent coverage (same ongoing event, same story arc)
   - If continuation: set article_type = "continuation", continuation_of = slug of original
   - If new topic: set article_type = "new", continuation_of = null
6. One sentence of reasoning for persona choice

Return ONLY a valid JSON array (one object per item, in same order):
[
  {
    "persona": "elena-voss" | "marcus-webb" | "leo-cruz",
    "angle": "specific angle for this persona",
    "urgency": "breaking" | "standard",
    "expires_at": "ISO datetime",
    "article_type": "new" | "continuation",
    "continuation_of": null | "slug-string",
    "reasoning": "one sentence"
  }
]`;

  try {
    const res    = await callClaude({ model: 'claude-sonnet-4-6', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] });
    const text   = await res.json() as { content: { text: string }[] };
    const raw    = text.content[0]?.text ?? '';
    const match  = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array from triage');
    const parsed = JSON.parse(match[0]) as TriageResult[];
    if (!Array.isArray(parsed) || parsed.length !== items.length) throw new Error('Triage array length mismatch');
    return parsed;
  } catch {
    return items.map((item) => fallbackTriage(item, breakingExp, standardExp));
  }
}

function fallbackTriage(item: TriageInput, breakingExp: string, standardExp: string): TriageResult {
  const text    = `${item.title} ${item.snippet}`.toLowerCase();
  let   persona: TriageResult['persona'] = 'leo-cruz';

  if (/fed|rate|cpi|inflation|ecb|yield|macro|dxy|fomc|treasury|bonds/.test(text)) {
    persona = 'elena-voss';
  } else if (/on-chain|netflow|whale|miner|glassnode|mempool|exchange flow|hash/.test(text)) {
    persona = 'marcus-webb';
  }

  const urgency = item.score >= 80 ? 'breaking' : 'standard';
  return {
    persona,
    angle:           `${PERSONA_DISPLAY[persona]} perspective on: ${item.title}`,
    urgency,
    expires_at:      urgency === 'breaking' ? breakingExp : standardExp,
    article_type:    'new',
    continuation_of: null,
    reasoning:       'Rule-based fallback assignment',
  };
}

const PERSONA_DISPLAY: Record<string, string> = {
  'elena-voss':  'Elena Voss (macro)',
  'marcus-webb': 'Marcus Webb (on-chain)',
  'leo-cruz':    'Leo Cruz (narrative)',
};
