// Rewrites Elena Voss bootstrap article: argumentative frame, concrete verdict,
// removes defensive meta-commentary. Patches Sanity in-place.

import { createClient } from '@sanity/client';

const SLUG = 'bitcoin-doesnt-get-a-liquidity-exception-mq0krlft';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SANITY_TOKEN  = process.env.SANITY_TOKEN;

const sanity = createClient({
  projectId: 'x55aaanw', dataset: 'production',
  token: SANITY_TOKEN, apiVersion: '2024-01-01', useCdn: false,
});

// ── Current article text ──────────────────────────────────────────────────────

const CURRENT_BODY = `## The Liquidity Regime Is What Matters

Bitcoin fell 3.19% in the last 24 hours. Not because of an exchange hack or regulatory crackdown, but because it's doing exactly what risk assets do when the cost of money rises and liquidity conditions tighten. The 10-year Treasury is sitting at 4.49%, the Fed Funds rate at 3.63%, and the yield curve just re-steepened to +0.41% after two years inverted. These aren't background variables. They're the entire game.

I spent twelve years in traditional finance—fixed income trading at Deutsche Bank, then macro strategy at a European family office—watching central bank language move markets before the first basis point ever shifted. The crypto native crowd talks about Bitcoin like it exists in a separate monetary universe, governed by hash rates and halvings and Michael Saylor's conviction. It doesn't. It's governed by the same force that moves junk bonds, unprofitable tech stocks, and Magnificent Seven momentum: the price and availability of dollars.

I resisted this space until 2021, not because I didn't understand the technology but because I didn't see the macro case. What changed wasn't the whitepaper—it was watching BTC correlate to the Nasdaq at 0.8+ while everyone pretended it was "digital gold." Gold doesn't drop 60% when the Fed tightens. Risk assets do.

## What I Watch and Why It Matters

My framework is straightforward: follow the liquidity, ignore the narrative. That means four things.

Fed language precision. Not just the dot plot, but the marginal shift in language between "additional firming may be appropriate" and "sufficiently restrictive." Core PCE is at 3.29%—still above target, still giving hawks ammunition. When Powell's syntax changes, positioning changes before the policy does.

Yield curve shape. We just exited the longest inversion since the 1970s. A steepening curve from current levels (41 basis points, 2Y at 4.08%, 10Y at 4.49%) historically signals either growth expectations returning or term premium expanding. One is good for risk assets. The other isn't. The difference matters enormously.

Dollar strength. The broad dollar index at 118.88 is elevated but off recent peaks. A strong dollar tightens global financial conditions even when the Fed pauses. It drains liquidity from emerging markets, pressures commodity prices, and makes dollar-denominated assets like Bitcoin less attractive to non-US buyers. Currency moves are liquidity moves.

BTC correlation to risk. When Bitcoin trades with tech stocks, it is a tech stock. When correlation breaks, something structural is shifting—either in crypto-specific flows or in macro regime. Right now, correlation is holding. That tells you what's driving price.

## What I'll Be Writing

This isn't a trading newsletter. I won't be calling tops or bottoms. What I will do is map the macro regime—where we are in the liquidity cycle, what the Fed is actually signaling versus what markets are pricing, and how that regime governs everything including this asset class.

Expect analysis on rate policy, credit conditions, dollar liquidity, and when macro creates asymmetric setups. Expect skepticism toward narratives that ignore funding costs. Expect frameworks, not predictions.

## The Signal I'm Watching Now

The spread between CPI at 3.78% and Core PCE at 3.29%. That 49 basis point gap is the space where the Fed decides whether they're done or not. If headline inflation falls faster than core, they'll take the political win and hold steady. If core stays sticky while headline rebounds, the hiking conversation returns. Everything—equities, credit, and yes, Bitcoin—reprice from there.`;

// ── Rewrite prompt ────────────────────────────────────────────────────────────

const PROMPT = `You are Elena Voss, macro analyst at finc.news. Rewrite the article below.

WHAT TO FIX:
1. Remove the entire "What I'll Be Writing" section — it's meta-commentary, not analysis
2. "The Signal I'm Watching Now" must end with your VERDICT, not a question.
   Elena is watchful, not bearish yet — but she has a position: the 49bps gap between CPI
   and Core PCE means the Fed can still claim progress without cutting. That keeps rates
   higher for longer than crypto Twitter expects. State this explicitly.
3. In the "What I Watch" section: cut the list structure. Convert it into flowing argument.
   Don't list four things — build one argument that uses those four data points as evidence.
4. The closing sentence must be a position: "I am [watchful/cautious/neutral] because X."
   Not "everything reprices from there" — that's a non-sentence.

WHAT TO KEEP:
- The cold open (first two paragraphs) — strong, keep as-is
- All the real macro numbers: Fed 3.63%, 10Y 4.49%, 2Y 4.08%, spread +0.41%,
  CPI 3.78%, Core PCE 3.29%, USD 118.88, BTC -3.20%
- Elena's voice: dry, precise, no hype, TradFi frame

ELENA'S CURRENT POSITION (you must reflect this):
She is WATCHFUL-CAUTIOUS. Not calling a crash. But not bullish.
The yield curve just un-inverted — the market reads this as bullish. She disagrees.
Historical precedent: yield curve un-inversions precede recessions 70%+ of the time,
not recoveries. The steepening is term premium expanding, not growth expectations.
That's the difference that matters, and the market is pricing the wrong scenario.
Bitcoin at $60-70k range is priced for "Fed done + growth returning."
She thinks the correct read is "Fed done + growth slowing" — a very different regime.

STYLE RULES:
- No defensive disclaimers ("this isn't X", "I won't Y")
- No "what I'll be writing" forward-looking meta-commentary
- End with her verdict, not a question or a "watch X" non-answer
- Dry, authoritative tone throughout
- ~550 words

CURRENT ARTICLE:
${CURRENT_BODY}

Return ONLY valid JSON:
{
  "title": "keep or improve — must be a thesis, not a label",
  "excerpt": "2-3 sentences, Elena's position stated (max 220 chars)",
  "body": "full rewritten article in markdown, use ## for headers",
  "metaTitle": "SEO title max 60 chars",
  "metaDescription": "max 155 chars",
  "telegramText": "5-7 lines, Elena's position + key numbers, end with {URL}"
}`;

// ── Call Claude ───────────────────────────────────────────────────────────────

console.log('Calling Claude for rewrite...');
const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
  body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 3000, messages: [{ role: 'user', content: PROMPT }] }),
});

if (!res.ok) { console.error('Claude error:', await res.text()); process.exit(1); }

const json = await res.json();
const text = json.content[0]?.text ?? '';
const match = text.match(/\{[\s\S]*\}/);
if (!match) { console.error('No JSON in response:\n', text); process.exit(1); }

const article = JSON.parse(match[0]);
console.log('\nNew title:', article.title);
console.log('\nExcerpt:', article.excerpt);
console.log('\n--- Body preview (first 300 chars) ---');
console.log(article.body.slice(0, 300));

// ── markdownToPortableText ────────────────────────────────────────────────────

function parseInline(text, bi) {
  const spans = []; let idx = 0, last = 0;
  const re = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g; let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) spans.push({ _type:'span', _key:`s-${bi}-${idx++}`, text: text.slice(last, m.index), marks:[] });
    const bold = m[0].startsWith('**');
    spans.push({ _type:'span', _key:`s-${bi}-${idx++}`, text: bold?m[1]:m[2], marks:[bold?'strong':'em'] });
    last = m.index + m[0].length;
  }
  if (last < text.length) spans.push({ _type:'span', _key:`s-${bi}-${idx}`, text: text.slice(last), marks:[] });
  return spans.length ? spans : [{ _type:'span', _key:`s-${bi}-0`, text, marks:[] }];
}

function mdToPT(md) {
  return md.split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map((p, i) => {
    const h2 = p.match(/^##\s+(.+)$/), h3 = p.match(/^###\s+(.+)$/);
    if (h2||h3) return { _type:'block', _key:`b-${i}`, style: h2?'h2':'h3', markDefs:[], children:[{ _type:'span', _key:`s-${i}-0`, text: h2?.[1]??h3?.[1], marks:[] }] };
    return { _type:'block', _key:`b-${i}`, style:'normal', markDefs:[], children: parseInline(p, i) };
  });
}

// ── Patch Sanity ──────────────────────────────────────────────────────────────

const doc = await sanity.fetch(`*[_type=="article" && slug.current==$slug][0]{ _id }`, { slug: SLUG });
if (!doc) { console.error('Article not found in Sanity'); process.exit(1); }

await sanity.patch(doc._id).set({
  'translations.en.title':           article.title,
  'translations.en.excerpt':         article.excerpt,
  'translations.en.body':            mdToPT(article.body),
  'translations.en.metaTitle':       article.metaTitle,
  'translations.en.metaDescription': article.metaDescription,
  'translations.en.telegramText':    article.telegramText,
}).commit();

console.log(`\n✓ Patched Sanity doc ${doc._id}`);
console.log(`  https://finc.news/economy/${SLUG}`);
