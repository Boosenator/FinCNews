export interface FredSeries {
  seriesId: string;
  value: number;
  date: string;
}

export interface SecFiling {
  title: string;
  filedAt: string;
  entityName: string;
  formType: string;
  url: string;
}

export interface ElenaDataPull {
  // FRED macro data
  fedFundsRate: number;
  cpiYoY: number;
  corePce: number;
  tenYearYield: number;
  twoYearYield: number;
  dxyIndex: number;
  yieldCurveSpread: number; // tenYear - twoYear
  // Market context
  btcChange24h: number;
  // SEC
  secFilings: SecFiling[];
  // Pull timestamp
  pulledAt: string;
}

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

async function fetchFredSeries(
  seriesId: string,
  apiKey: string,
  units: 'lin' | 'pc1' = 'lin'  // lin=level, pc1=percent change from year ago
): Promise<number> {
  const url = new URL(FRED_BASE);
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('file_type', 'json');
  url.searchParams.set('sort_order', 'desc');
  url.searchParams.set('limit', '1');
  url.searchParams.set('units', units);
  url.searchParams.set('observation_start', '2020-01-01');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`FRED ${seriesId}: ${res.status}`);

  const data = await res.json() as { observations: { value: string }[] };
  const latest = data.observations?.[0]?.value;
  if (!latest || latest === '.') throw new Error(`FRED ${seriesId}: no data`);
  return parseFloat(latest);
}

async function fetchSecFilings(): Promise<SecFiling[]> {
  const terms = ['cryptocurrency', 'bitcoin', 'digital+asset', 'stablecoin', 'crypto+exchange'];
  const results: SecFiling[] = [];

  // SEC EDGAR full-text search — public, no key needed
  const url = `https://efts.sec.gov/LATEST/search-index?q=%22cryptocurrency%22+OR+%22bitcoin%22+OR+%22digital+asset%22&dateRange=custom&startdt=${twoDaysAgo()}&enddt=${today()}&forms=8-K,press,NOTICE,ORDER`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'finc.news editorial-bot contact@finc.news' },
    });
    if (!res.ok) return [];

    const data = await res.json() as {
      hits: { hits: { _source: { period_of_report: string; display_names: string[]; form_type: string; file_date: string; } }[] };
    };

    for (const hit of data.hits?.hits?.slice(0, 5) ?? []) {
      const s = hit._source;
      results.push({
        title: s.display_names?.[0] ?? 'Unknown',
        filedAt: s.file_date ?? s.period_of_report,
        entityName: s.display_names?.[0] ?? '',
        formType: s.form_type ?? '',
        url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany`,
      });
    }
  } catch {
    // SEC API is best-effort
  }

  void terms; // used in URL construction above
  return results;
}

async function fetchBtcChange(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'
    );
    if (!res.ok) return 0;
    const data = await res.json() as { bitcoin: { usd_24h_change: number } };
    return data.bitcoin?.usd_24h_change ?? 0;
  } catch {
    return 0;
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function twoDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return d.toISOString().slice(0, 10);
}

export async function pullElenaData(): Promise<ElenaDataPull> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) throw new Error('FRED_API_KEY not set');

  const [
    fedFundsRate,
    cpiYoY,
    corePce,
    tenYearYield,
    twoYearYield,
    dxyIndex,
    secFilings,
    btcChange24h,
  ] = await Promise.allSettled([
    fetchFredSeries('FEDFUNDS',  apiKey, 'lin'),  // effective fed funds rate (%)
    fetchFredSeries('CPIAUCSL',  apiKey, 'pc1'),  // CPI percent change from year ago
    fetchFredSeries('PCEPILFE',  apiKey, 'pc1'),  // Core PCE percent change from year ago
    fetchFredSeries('DGS10',     apiKey, 'lin'),  // 10Y Treasury yield (%)
    fetchFredSeries('DGS2',      apiKey, 'lin'),  // 2Y Treasury yield (%)
    fetchFredSeries('DTWEXBGS',  apiKey, 'lin'),  // Broad dollar index (level, not %)

    fetchSecFilings(),
    fetchBtcChange(),
  ]).then(results => results.map(r => (r.status === 'fulfilled' ? r.value : null)));

  return {
    fedFundsRate:     (fedFundsRate  as number)  ?? 0,
    cpiYoY:           (cpiYoY        as number)  ?? 0,
    corePce:          (corePce       as number)  ?? 0,
    tenYearYield:     (tenYearYield  as number)  ?? 0,
    twoYearYield:     (twoYearYield  as number)  ?? 0,
    dxyIndex:         (dxyIndex      as number)  ?? 0,
    yieldCurveSpread: ((tenYearYield as number ?? 0) - (twoYearYield as number ?? 0)),
    secFilings:       (secFilings    as SecFiling[]) ?? [],
    btcChange24h:     (btcChange24h  as number)  ?? 0,
    pulledAt:         new Date().toISOString(),
  };
}
