import type { MarcusDataPull } from './data-pull';
import type { MarcusBaseline } from './baseline';
import { zScore } from './baseline';

export interface Anomaly {
  metric:    string;
  label:     string;     // human-readable
  value:     number;
  zScore:    number;
  direction: 'above' | 'below';
  source:    string;
  context:   string;     // "X% above 30-day mean of Y"
}

const THRESHOLD = 1.8;

export function detectAnomalies(data: MarcusDataPull, baseline: MarcusBaseline): Anomaly[] {
  const anomalies: Anomaly[] = [];

  const check = (
    metricKey: keyof MarcusBaseline['metrics'],
    value: number,
    label: string,
    source: string,
    unit = '',
    zeroMeansNoData = true
  ) => {
    if (zeroMeansNoData && value === 0) return; // skip if no data (API not configured)
    const bm = baseline.metrics[metricKey];
    if (bm.history.length < 7) return; // not enough history yet

    const z = zScore(value, bm);
    if (Math.abs(z) < THRESHOLD) return;

    const pct = bm.mean > 0 ? ((value - bm.mean) / bm.mean * 100).toFixed(1) : '—';
    anomalies.push({
      metric:    metricKey,
      label,
      value,
      zScore:    parseFloat(z.toFixed(2)),
      direction: value > bm.mean ? 'above' : 'below',
      source,
      context:   `${z > 0 ? '+' : ''}${pct}% vs 30-day mean of ${bm.mean.toFixed(unit === 'BTC' ? 0 : 2)}${unit}`,
    });
  };

  check('btcExchangeNetflow', data.btcExchangeNetflow, 'BTC Exchange Netflow', 'CoinGlass', ' BTC');
  check('btcVolumeRatio',     data.btcVolumeRatio,     'BTC Volume vs 30d avg', 'CoinGecko', 'x', false);
  check('btcHashrate',        data.btcHashrate,         'BTC Hashrate',          'mempool.space', ' TH/s');
  check('mempoolTxCount',     data.mempoolTxCount,      'Mempool Tx Count',      'mempool.space');
  check('fearGreedIndex',     data.fearGreedIndex,      'Fear & Greed Index',    'alternative.me', '', false);
  check('minerOutflows',      data.minerOutflows,       'Miner Outflows',        'CoinGlass', ' BTC');

  return anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
}

// Check if two anomalies point in the same market direction
export function areCorrelated(a: Anomaly, b: Anomaly): boolean {
  const bearishMetrics = new Set(['btcExchangeNetflow', 'minerOutflows']);
  const bearishA = bearishMetrics.has(a.metric) ? a.direction === 'above' : a.direction === 'below';
  const bearishB = bearishMetrics.has(b.metric) ? b.direction === 'above' : b.direction === 'below';
  return bearishA === bearishB; // both pointing same direction = correlated
}
