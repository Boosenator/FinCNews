import { callClaude, parseClaudeJson, type PublishableArticle } from '@/lib/personas/shared';
import type { MarcusDataPull } from './data-pull';
import type { Anomaly } from './anomalies';
import type { MarcusBaseline } from './baseline';
import type { ShouldWriteResult } from './should-write';

const SYSTEM_PROMPT = `You are Marcus Webb, on-chain data analyst at finc.news.

BACKGROUND:
8 years institutional finance (fixed income, systematic strategies), 6 years in crypto markets.
Spent 4 years at a hedge fund doing on-chain surveillance. You crossed into crypto because the
data was more honest than equity markets. You've been right more often than wrong, which is why
you never guess.

CORE BELIEF:
Markets are flows. Everything that moves leaves an on-chain trace. If the data isn't showing
an anomaly, there is nothing to write about today.

WRITING RULES (non-negotiable):
1. Open with the specific metric, its current value, and its deviation from the 30-day norm
2. Paragraph 2: last time this happened (date, price context, what followed)
3. Paragraph 3: one or two corroborating signals — never unrelated data padding
4. Paragraph 4: "What to watch" — one metric, one threshold, one timeframe
5. Maximum 400 words
6. Never: suggests, could mean, might, bullish, bearish, interesting, exciting
7. Always cite source inline: "Exchange inflows (CoinGlass)..."
8. No emoji, no exclamation marks, no rhetorical questions

STRUCTURE TEMPLATE:
[Metric] reached [value] — [z-score deviation]. The last comparable reading was [date].
[Historical precedent]. [Corroborating signal]. [Second if strong].
What to watch: if [metric] [crosses] [threshold], [implication].

VOICE TEST: Would this read on a Bloomberg terminal? If no — rewrite.

EDITORIAL DIRECTIVE:
Your context may include feedback from Victor Kane (Chief Editor).
If it does — treat it as a direct instruction, not a suggestion:
- "Priority fix" → the ONE thing you must improve in THIS article
- "Directive" → active standing instruction, apply it now
- "Pattern warning" → consciously avoid this opening or structure
Victor Kane's feedback overrides your default patterns. Ignoring it is not an option.`;

export async function generateMarcusArticle(
  data:       MarcusDataPull,
  anomalies:  Anomaly[],
  evalResult: ShouldWriteResult,
  baseline:   MarcusBaseline,
  context:    string
): Promise<PublishableArticle> {
  const primaryAnomaly = anomalies[0];
  const supporting     = anomalies.slice(1, 3);

  const userPrompt = `TODAY'S ANOMALIES:
Primary: ${primaryAnomaly.label} = ${primaryAnomaly.value.toFixed(2)} (z-score: ${primaryAnomaly.zScore > 0 ? '+' : ''}${primaryAnomaly.zScore}, ${primaryAnomaly.context})
${supporting.length > 0 ? `Supporting:\n${supporting.map((a) => `- ${a.label} (${a.source}): z=${a.zScore}, ${a.context}`).join('\n')}` : 'No corroborating anomalies.'}

TODAY'S FULL DATA SNAPSHOT:
- BTC Price: $${data.btcPrice.toLocaleString()}
- BTC Volume 24h: $${(data.btcVolume24h / 1e9).toFixed(2)}B (${data.btcVolumeRatio.toFixed(2)}x 30d avg)
- BTC Exchange Netflow: ${data.btcExchangeNetflow > 0 ? '+' : ''}${data.btcExchangeNetflow.toFixed(0)} BTC (CoinGlass)
- Miner Outflows: ${data.minerOutflows.toFixed(0)} BTC (CoinGlass)
- Mempool Tx: ${data.mempoolTxCount.toLocaleString()} (mempool.space)
- Hashrate: ${(data.btcHashrate / 1e6).toFixed(2)} EH/s (mempool.space)
- Fear & Greed: ${data.fearGreedIndex}/100
- BTC Dominance: ${data.btcDominance.toFixed(1)}%

30-DAY BASELINE (for historical context):
- Exchange Netflow mean: ${baseline.metrics.btcExchangeNetflow.mean.toFixed(0)} BTC (σ=${baseline.metrics.btcExchangeNetflow.std.toFixed(0)})
- Volume Ratio mean: ${baseline.metrics.btcVolumeRatio.mean.toFixed(2)}x

YOUR CONTEXT (recent articles, open forecasts):
${context || 'No prior context — first article.'}

WRITE DECISION:
- Topic: ${evalResult.topic}
- Primary metric: ${evalResult.primary_metric}

Write the article. Respond ONLY with valid JSON:
{
  "title": "data-driven title, max 80 chars — lead with the metric or number",
  "excerpt": "2-3 sentences with the core anomaly and implication (max 220 chars)",
  "body": "full article in markdown, use ## for headers, max 400 words",
  "metaTitle": "SEO title max 60 chars",
  "metaDescription": "max 155 chars",
  "tags": ["on-chain", "bitcoin", "exchange-flows"],
  "category": "crypto",
  "telegramText": "5-7 lines. Numbers first. Source in parentheses. End with {URL}"
}`;

  const res = await callClaude({
    model:      'claude-sonnet-4-5',
    max_tokens: 2200,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: userPrompt }],
  });

  return parseClaudeJson<PublishableArticle>(res);
}
