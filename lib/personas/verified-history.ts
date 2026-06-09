import { supabaseAdmin } from '@/lib/supabase';

type Supabase = ReturnType<typeof supabaseAdmin>;

// ── Curated verifiable event list ────────────────────────────────────────────
// Maintained manually. Only add events you can verify independently.
// Format: [YYYY-MM-DD] Description with key numbers.

const KNOWN_EVENTS_MARCUS = `
[2020-03-12] COVID crash: BTC $3,800 low. Exchange inflows spiked. Fear & Greed: 8.
[2021-02-21] BTC $58,000 peak before 50% correction. Miner outflows elevated for 3 weeks prior.
[2021-11-10] BTC ATH: $69,000. Fear & Greed: 84. Exchange reserves hit multi-year low.
[2022-05-12] LUNA/UST collapse. BTC fell $36k→$26k in 72h. Exchange inflows +80k BTC.
[2022-06-18] BTC $17,600 (3AC/Celsius contagion). Miner capitulation: hashrate -17%.
[2022-11-11] FTX bankruptcy. BTC $16,000. Exchange netflows spiked +45k BTC in 48h. Fear & Greed: 6.
[2023-01-12] BTC recovery to $21,000 after CPI miss. Exchange outflows resumed.
[2023-03-10] SVB collapse. BTC +20% in 2 weeks as DXY fell. Flight to non-bank assets.
[2024-01-10] BTC spot ETF approved (BlackRock/Fidelity). BTC ~$46k. Exchange reserves dropped sharply post-approval.
[2024-03-14] BTC new ATH: $73,700. Miner outflows elevated pre-halving.
[2024-04-20] BTC halving (block 840,000). Block reward: 3.125 BTC.
[2024-09-18] Fed first rate cut: -25bp to 4.75–5.0%.
[2025-01-20] BTC ATH: $109,000 (Trump inauguration). Exchange reserves near all-time low.
`.trim();

const KNOWN_EVENTS_ELENA = `
[2020-03-15] Fed emergency cut to 0–0.25%. QE restarted ($700B). BTC correlated sell-off, then recovery.
[2021-11-03] Fed taper announcement. BTC peaked at $69k same week — last rally before tightening.
[2022-03-16] Fed first hike: +25bp. Start of fastest hiking cycle since 1980.
[2022-06-15] Fed +75bp (first jumbo hike). BTC: $20,000. DXY hit 105.
[2022-09-13] CPI 8.3% (hotter than expected). BTC -10% in 1 hour. DXY 110.
[2022-11-02] Fed +75bp (4th consecutive). Terminal rate expectations: 5%+.
[2023-02-01] Fed slowed to +25bp. "Disinflation" word used — markets rallied.
[2023-03-22] Fed +25bp despite SVB collapse. Balance sheet expanded $300B in crisis response.
[2023-07-26] Final Fed hike: 5.25–5.5%. Core PCE: 4.2%. 10Y yield: 3.9%.
[2024-01-12] CPI 3.4% — above 3.0% target. Delayed March cut expectations.
[2024-09-18] Fed first cut: -50bp to 4.75–5.0%. Core PCE at 2.7%.
[2024-12-18] Fed cut to 4.25–4.5%. Dot plot: only 2 cuts expected in 2025.
[2025-01-29] Fed held at 4.25–4.5%. No cut signal.
[2025-03-12] CPI 2.8% YoY. Core PCE 2.6%. 10Y yield: 4.3%.
`.trim();

const KNOWN_EVENTS_LEO = `
[2020-06–09] DeFi Summer: Compound launched COMP, total DeFi TVL 10x'd in 3 months. Yield farming narrative peak.
[2020-12-16] BTC $20,000 first close above 2017 ATH — "institutional adoption" narrative became dominant.
[2021-01–04] NFT narrative emerged: NBA Top Shot, then Beeple $69M sale (Mar 2021).
[2021-04-14] Coinbase IPO ($100B valuation). "Crypto going mainstream" narrative peaked within weeks.
[2021-05-19] China mining ban FUD. BTC -30% in 1 week. Leverage flush: $8B liquidated.
[2021-10-21] BTC ETF futures launch (BITO). Bitcoin narrative re-ignited, new ATH 3 weeks later.
[2022-01-22] "Risk-off" macro narrative took over: BTC fell from $47k with tech stocks. Crypto-macro correlation cemented.
[2022-05-12] LUNA collapse killed "algorithmic stablecoin" narrative permanently. Contagion into DeFi.
[2022-11-11] FTX collapse killed "CeFi is safer than DeFi" narrative. Self-custody narrative emerged.
[2023-02-14] Ordinals/Bitcoin NFT narrative launched. Debate: Bitcoin as L1 vs store of value.
[2023-03-27] Arbitrum airdrop — L2 narrative peak. $ARB launched, Optimism followed.
[2023-06–12] AI × crypto narrative emerged (Worldcoin, Fetch.ai). Driven by ChatGPT mainstream adoption.
[2024-01-10] Spot BTC ETF approval. "Institutional on-ramp" narrative replaced speculation with flows.
[2024-03-14] BTC ATH $73,700. Altcoin season narrative started, most alts underperformed.
[2024-11-06] Trump election — "crypto-friendly administration" narrative. BTC $75k same day.
[2025-01-20] BTC ATH $109,000. Meme coin supercycle narrative (TRUMP, MELANIA). Faded within weeks.
`.trim();

export const KNOWN_EVENTS: Record<string, string> = {
  'marcus-webb': KNOWN_EVENTS_MARCUS,
  'elena-voss':  KNOWN_EVENTS_ELENA,
  'leo-cruz':    KNOWN_EVENTS_LEO,
};

// ── Dynamic history from DB ───────────────────────────────────────────────────

/**
 * Builds a dated record of verified events:
 *  1. Curated pre-coverage known events (static, above)
 *  2. Persona's own published articles (persona_memory type=article, with dates)
 *  3. Team coverage log (coverage_log — all personas, last 60 days)
 *  4. Signal snapshots (last 14 days of real market readings)
 *
 * Passed to generate prompts so the model cites real history,
 * not hallucinated dates, prices, or token names.
 */
export async function buildVerifiedHistory(
  supabase: Supabase,
  personaId: string
): Promise<string> {
  const since60d = new Date(Date.now() - 60  * 24 * 60 * 60 * 1000).toISOString();
  const since14d = new Date(Date.now() - 14  * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: ownArticles },
    { data: teamCoverage },
    { data: snapshots },
  ] = await Promise.all([
    supabase
      .from('persona_memory')
      .select('content, metadata, created_at')
      .eq('persona_id', personaId)
      .eq('memory_type', 'article')
      .order('created_at', { ascending: false })
      .limit(20),

    supabase
      .from('coverage_log')
      .select('title, persona_id, published_at')
      .gte('published_at', since60d)
      .order('published_at', { ascending: false })
      .limit(40),

    supabase
      .from('persona_memory')
      .select('content, created_at')
      .eq('persona_id', personaId)
      .eq('memory_type', 'signal_snapshot')
      .gte('created_at', since14d)
      .order('created_at', { ascending: false })
      .limit(14),
  ]);

  const lines: string[] = [
    '=== VERIFIED HISTORICAL RECORD ===',
    'Use ONLY events, dates, and numbers listed here as historical references.',
    'If the parallel you need is absent — describe the regime type without inventing specifics.',
    '',
  ];

  // 1. Curated known events
  const knownEvents = KNOWN_EVENTS[personaId];
  if (knownEvents) {
    lines.push('── Major known events (pre-coverage, verified) ──');
    lines.push(knownEvents);
    lines.push('');
  }

  // 2. Own articles with dates
  if (ownArticles?.length) {
    lines.push('── Your published articles ──');
    for (const a of ownArticles) {
      const date = (a.created_at as string).slice(0, 10);
      const meta = a.metadata as { title?: string; topic?: string; tags?: string[] };
      const label = meta.title ?? (a.content as string).slice(0, 80);
      const topic = meta.topic ?? meta.tags?.[0] ?? '';
      lines.push(`[${date}] ${label}${topic ? ` · ${topic}` : ''}`);
    }
    lines.push('');
  }

  // 3. Team coverage (other personas)
  const others = (teamCoverage ?? []).filter(c => c.persona_id !== personaId);
  if (others.length) {
    lines.push('── finc.news team coverage (last 60 days) ──');
    for (const c of others) {
      const date = (c.published_at as string).slice(0, 10);
      lines.push(`[${date}] ${c.title} (${c.persona_id})`);
    }
    lines.push('');
  }

  // 4. Signal snapshots
  if (snapshots?.length) {
    lines.push('── Verified market readings (last 14 days) ──');
    for (const s of snapshots) {
      const date = (s.created_at as string).slice(0, 10);
      const summary = (s.content as string).split('\n').slice(0, 3).join(' | ');
      lines.push(`[${date}] ${summary}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
