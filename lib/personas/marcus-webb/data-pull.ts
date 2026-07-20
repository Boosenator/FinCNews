export interface MarcusDataPull {
  // CoinGecko
  btcPrice:        number;
  btcVolume24h:    number;
  btcVolume30dAvg: number;   // calculated from history
  btcVolumeRatio:  number;   // current / 30d avg
  btcDominance:    number;   // %

  // CoinGlass (COINGLASS_API_KEY required; 0 if unavailable)
  btcExchangeNetflow: number; // positive = inflows, negative = outflows (BTC)
  minerOutflows:      number; // BTC leaving miner wallets (24h)

  // mempool.space
  mempoolTxCount: number;
  mempoolAvgFeeRate: number;  // sat/vB
  btcHashrate:    number;     // TH/s
  btcHashrate30dAvg: number;

  // Alternative.me
  fearGreedIndex: number;

  pulledAt: string;
}

// ── CoinGecko ─────────────────────────────────────────────────────────────────

async function fetchCoinGecko(): Promise<Pick<
  MarcusDataPull, 'btcPrice' | 'btcVolume24h' | 'btcVolume30dAvg' | 'btcVolumeRatio' | 'btcDominance'
>> {
  const [market, history, globalData] = await Promise.allSettled([
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_vol=true').then((r) => r.json()),
    fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30&interval=daily').then((r) => r.json()),
    fetch('https://api.coingecko.com/api/v3/global').then((r) => r.json()),
  ]);

  const btcPrice      = market.status === 'fulfilled' ? (market.value as { bitcoin: { usd: number } }).bitcoin.usd : 0;
  const btcVolume24h  = market.status === 'fulfilled' ? (market.value as { bitcoin: { usd_24h_vol: number } }).bitcoin.usd_24h_vol : 0;
  const btcDominance  = globalData.status === 'fulfilled' ? ((globalData.value as { data: { market_cap_percentage: { btc: number } } }).data.market_cap_percentage.btc ?? 0) : 0;

  let btcVolume30dAvg = btcVolume24h;
  if (history.status === 'fulfilled') {
    const volumes = (history.value as { total_volumes: [number, number][] }).total_volumes?.map((v) => v[1]) ?? [];
    if (volumes.length > 0) btcVolume30dAvg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  }

  return {
    btcPrice,
    btcVolume24h,
    btcVolume30dAvg,
    btcVolumeRatio: btcVolume30dAvg > 0 ? btcVolume24h / btcVolume30dAvg : 1,
    btcDominance,
  };
}

// ── CoinGlass ─────────────────────────────────────────────────────────────────

async function fetchCoinGlass(): Promise<{ netflow: number; minerOutflows: number }> {
  const key = process.env.COINGLASS_API_KEY;
  if (!key) return { netflow: 0, minerOutflows: 0 };

  try {
    const headers = { 'CG-API-KEY': key };

    // Exchange netflow
    const netflowRes = await fetch(
      'https://open-api.coinglass.com/public/v2/indicator/bitcoin_exchanges_net_flow',
      { headers }
    );

    let netflow = 0;
    if (netflowRes.ok) {
      const data = await netflowRes.json() as { data?: { netflow?: number }[] };
      netflow = data.data?.[0]?.netflow ?? 0;
    }

    // Miner outflows (best-effort)
    let minerOutflows = 0;
    const minerRes = await fetch(
      'https://open-api.coinglass.com/public/v2/indicator/bitcoin_miner_net_position_change',
      { headers }
    ).catch(() => null);

    if (minerRes?.ok) {
      const data = await minerRes.json() as { data?: { netPositionChange?: number }[] };
      minerOutflows = Math.abs(data.data?.[0]?.netPositionChange ?? 0);
    }

    return { netflow, minerOutflows };
  } catch {
    return { netflow: 0, minerOutflows: 0 };
  }
}

// ── mempool.space ─────────────────────────────────────────────────────────────

async function fetchMempool(): Promise<{
  txCount: number;
  avgFeeRate: number;
  hashrate: number;
  hashrate30dAvg: number;
}> {
  try {
    const [mempoolRes, hashrateRes] = await Promise.allSettled([
      fetch('https://mempool.space/api/mempool').then((r) => r.json()),
      fetch('https://mempool.space/api/v1/mining/hashrate/1m').then((r) => r.json()),
    ]);

    const txCount    = mempoolRes.status === 'fulfilled' ? (mempoolRes.value as { count: number }).count : 0;
    const avgFeeRate = mempoolRes.status === 'fulfilled'
      ? (() => {
          const histogram = (mempoolRes.value as { fee_histogram?: [number, number][] }).fee_histogram ?? [];
          const total = histogram.reduce((s, [, w]) => s + w, 0);
          const weighted = histogram.reduce((s, [r, w]) => s + r * w, 0);
          return total > 0 ? weighted / total : 0;
        })()
      : 0;

    let hashrate = 0;
    let hashrate30dAvg = 0;
    if (hashrateRes.status === 'fulfilled') {
      const data = hashrateRes.value as { hashrates?: { avgHashrate: number }[] };
      const rates = (data.hashrates ?? []).map((h) => h.avgHashrate).filter(Boolean);
      if (rates.length > 0) {
        hashrate = rates[rates.length - 1];
        hashrate30dAvg = rates.reduce((a, b) => a + b, 0) / rates.length;
      }
    }

    return { txCount, avgFeeRate, hashrate, hashrate30dAvg };
  } catch {
    return { txCount: 0, avgFeeRate: 0, hashrate: 0, hashrate30dAvg: 0 };
  }
}

// ── Fear & Greed ──────────────────────────────────────────────────────────────

async function fetchFearGreed(): Promise<number> {
  try {
    const res  = await fetch('https://api.alternative.me/fng/?limit=1');
    const data = await res.json() as { data: { value: string }[] };
    return parseInt(data.data[0]?.value ?? '50', 10);
  } catch {
    return 50;
  }
}

// ── Main pull ─────────────────────────────────────────────────────────────────

export async function pullMarcusData(): Promise<MarcusDataPull> {
  const [cg, coinglass, mempool, fearGreed] = await Promise.allSettled([
    fetchCoinGecko(),
    fetchCoinGlass(),
    fetchMempool(),
    fetchFearGreed(),
  ]).then((r) => r.map((x) => (x.status === 'fulfilled' ? x.value : null)));

  const cgData = cg as Awaited<ReturnType<typeof fetchCoinGecko>> | null;
  const cglass = coinglass as { netflow: number; minerOutflows: number } | null;
  const mem    = mempool as Awaited<ReturnType<typeof fetchMempool>> | null;

  return {
    btcPrice:           cgData?.btcPrice        ?? 0,
    btcVolume24h:       cgData?.btcVolume24h     ?? 0,
    btcVolume30dAvg:    cgData?.btcVolume30dAvg  ?? 0,
    btcVolumeRatio:     cgData?.btcVolumeRatio   ?? 1,
    btcDominance:       cgData?.btcDominance     ?? 0,
    btcExchangeNetflow: cglass?.netflow          ?? 0,
    minerOutflows:      cglass?.minerOutflows    ?? 0,
    mempoolTxCount:     mem?.txCount             ?? 0,
    mempoolAvgFeeRate:  mem?.avgFeeRate          ?? 0,
    btcHashrate:        mem?.hashrate            ?? 0,
    btcHashrate30dAvg:  mem?.hashrate30dAvg      ?? 0,
    fearGreedIndex:     (fearGreed as number | null) ?? 50,
    pulledAt:           new Date().toISOString(),
  };
}
