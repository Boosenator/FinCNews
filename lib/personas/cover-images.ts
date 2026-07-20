/**
 * Data visualization cover images for AI persona articles.
 * Generates SVG based on live data, uploads to Sanity, returns image reference.
 *
 * Marcus Webb  → sparkline of anomalous on-chain metric (30-day history)
 * Elena Voss   → macro data grid with yield curve indicator
 * Leo Cruz     → narrative cycle arc + fear & greed gauge
 */

import { createClient } from '@sanity/client';
import type { MarcusDataPull } from './marcus-webb/data-pull';
import type { MarcusBaseline } from './marcus-webb/baseline';
import type { Anomaly } from './marcus-webb/anomalies';
import type { ElenaDataPull } from './elena-voss/data-pull';
import type { LeoDataPull } from './leo-cruz/data-pull';
import type { NarrativeState } from './leo-cruz/narratives';

const W = 1200;
const H = 630;

// ── Sanity upload ─────────────────────────────────────────────────────────────

async function uploadSvg(svg: string, filename: string): Promise<{ _type: 'image'; asset: { _type: 'reference'; _ref: string } } | null> {
  try {
    const sanity = createClient({
      projectId: process.env.SANITY_PROJECT_ID!,
      dataset:   process.env.SANITY_DATASET ?? 'production',
      token:     process.env.SANITY_TOKEN!,
      apiVersion: '2024-01-01',
      useCdn: false,
    });

    const buffer = Buffer.from(svg, 'utf-8');
    const asset  = await sanity.assets.upload('image', buffer, {
      filename,
      contentType: 'image/svg+xml',
    });

    return { _type: 'image', asset: { _type: 'reference', _ref: asset._id } };
  } catch {
    return null;
  }
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function bg(): string {
  return `<rect width="${W}" height="${H}" fill="#09090b"/>`;
}

function grid(): string {
  const lines: string[] = [];
  for (let x = 0; x <= W; x += 120) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#18181b" stroke-width="1"/>`);
  for (let y = 0; y <= H; y += 90)  lines.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#18181b" stroke-width="1"/>`);
  return `<g opacity="0.6">${lines.join('')}</g>`;
}

function personaFooter(name: string, role: string, color: string): string {
  return `
    <line x1="60" y1="${H - 56}" x2="${W - 60}" y2="${H - 56}" stroke="#27272a" stroke-width="1"/>
    <text x="60" y="${H - 24}" font-family="system-ui,-apple-system,sans-serif" font-size="18" font-weight="700" fill="${color}">${name}</text>
    <text x="60" y="${H - 6}" font-family="system-ui,-apple-system,sans-serif" font-size="14" fill="#52525b">${role} · finc.news</text>
    <text x="${W - 60}" y="${H - 12}" text-anchor="end" font-family="system-ui,-apple-system,sans-serif" font-size="13" fill="#3f3f46">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</text>`;
}

function sparkline(
  values: number[],
  x0: number, y0: number, w: number, h: number,
  color: string
): string {
  if (values.length < 2) return '';
  const min   = Math.min(...values);
  const max   = Math.max(...values);
  const range = max - min || 1;

  const pts = values.map((v, i) => {
    const x = x0 + (i / (values.length - 1)) * w;
    const y = y0 + h - ((v - min) / range) * h;
    return [x, y] as [number, number];
  });

  const linePts = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `M ${pts[0][0]},${y0 + h} ${pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${pts[pts.length - 1][0]},${y0 + h} Z`;

  const [lx, ly] = pts[pts.length - 1];

  return `
    <path d="${areaPath}" fill="${color}" fill-opacity="0.08"/>
    <polyline points="${linePts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="6" fill="${color}" opacity="0.9"/>
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="12" fill="${color}" opacity="0.15"/>`;
}

function fearGreedArc(value: number, cx: number, cy: number, r: number): string {
  const angle = Math.PI * (1 - value / 100);
  const nx = cx + r * Math.cos(Math.PI);
  const ex = cx + r * Math.cos(0);
  const vx = (cx + r * Math.cos(angle)).toFixed(1);
  const vy = (cy - r * Math.sin(angle)).toFixed(1);
  const color = value <= 25 ? '#f87171' : value <= 45 ? '#fb923c' : value >= 75 ? '#34d399' : value >= 55 ? '#22d3ee' : '#71717a';
  const label = value <= 25 ? 'Extreme Fear' : value <= 45 ? 'Fear' : value >= 75 ? 'Extreme Greed' : value >= 55 ? 'Greed' : 'Neutral';

  return `
    <path d="M ${nx},${cy} A ${r},${r} 0 0 1 ${ex},${cy}" fill="none" stroke="#27272a" stroke-width="14" stroke-linecap="round"/>
    <path d="M ${nx},${cy} A ${r},${r} 0 0 1 ${vx},${vy}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"/>
    <circle cx="${vx}" cy="${vy}" r="9" fill="${color}"/>
    <text x="${cx}" y="${cy + 28}" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="32" font-weight="900" fill="white">${value}</text>
    <text x="${cx}" y="${cy + 52}" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="14" fill="${color}">${label}</text>`;
}

// ── Marcus Webb ───────────────────────────────────────────────────────────────

export async function generateMarcusCover(
  data:          MarcusDataPull,
  baseline:      MarcusBaseline,
  anomalies:     Anomaly[],
  primaryMetric: string | null
): Promise<ReturnType<typeof uploadSvg>> {
  const primary = anomalies[0] ?? null;
  const metricKey  = (primaryMetric ?? primary?.metric ?? 'btcVolumeRatio') as keyof typeof baseline.metrics;
  const bm         = baseline.metrics[metricKey as keyof typeof baseline.metrics];
  const history    = bm?.history ?? [];
  const zScore     = primary?.zScore ?? 0;
  const direction  = (zScore > 0 ? '▲' : '▼');
  const zColor     = Math.abs(zScore) >= 2.5 ? '#f87171' : '#2dd4bf';
  const metricLabel = primary?.label ?? 'On-Chain Metric';

  const chartX = 540, chartY = 120, chartW = 580, chartH = 280;

  const corroborating = anomalies.slice(1, 3);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bg()}
    ${grid()}

    <!-- Left panel: primary anomaly -->
    <text x="60" y="90" font-family="system-ui,-apple-system,sans-serif" font-size="12" font-weight="700" letter-spacing="3" fill="#2dd4bf" text-transform="uppercase">ON-CHAIN ANOMALY</text>
    <text x="60" y="170" font-family="system-ui,-apple-system,sans-serif" font-size="72" font-weight="900" fill="white">${direction}${Math.abs(zScore).toFixed(1)}<tspan font-size="28" fill="#52525b">σ</tspan></text>
    <text x="60" y="210" font-family="system-ui,-apple-system,sans-serif" font-size="20" font-weight="700" fill="#d4d4d8">${metricLabel}</text>

    <rect x="60" y="235" width="380" height="1" fill="#27272a"/>

    <!-- Current value -->
    <text x="60" y="275" font-family="system-ui,-apple-system,sans-serif" font-size="13" fill="#71717a">Current</text>
    <text x="60" y="298" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="700" fill="${zColor}">${primary?.context ?? ''}</text>

    <!-- Corroborating signals -->
    ${corroborating.map((a, i) => `
    <text x="60" y="${360 + i * 52}" font-family="system-ui,-apple-system,sans-serif" font-size="12" fill="#52525b">${a.source}</text>
    <text x="60" y="${378 + i * 52}" font-family="system-ui,-apple-system,sans-serif" font-size="15" font-weight="600" fill="#a1a1aa">${a.label}</text>
    <text x="360" y="${378 + i * 52}" text-anchor="end" font-family="system-ui,-apple-system,sans-serif" font-size="15" font-weight="700" fill="${a.zScore > 0 ? '#f87171' : '#22d3ee'}">${a.zScore > 0 ? '▲' : '▼'}${Math.abs(a.zScore).toFixed(1)}σ</text>
    `).join('')}

    <!-- Baseline samples badge -->
    <rect x="60" y="${H - 105}" width="120" height="26" rx="13" fill="#27272a"/>
    <text x="120" y="${H - 87}" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="12" fill="#71717a">${baseline.samples}d baseline</text>

    <!-- Right panel: sparkline -->
    <rect x="${chartX - 10}" y="${chartY - 10}" width="${chartW + 20}" height="${chartH + 20}" rx="12" fill="#0f0f11" stroke="#1f1f23"/>
    <text x="${chartX}" y="${chartY - 20}" font-family="system-ui,-apple-system,sans-serif" font-size="12" fill="#52525b">30-day history</text>
    ${history.length > 1 ? sparkline(history, chartX, chartY, chartW, chartH, zColor) : `<text x="${chartX + chartW / 2}" y="${chartY + chartH / 2}" text-anchor="middle" fill="#3f3f46" font-family="system-ui,-apple-system,sans-serif" font-size="16">Accumulating baseline...</text>`}

    ${personaFooter('Marcus Webb', 'On-Chain Analyst', '#2dd4bf')}
  </svg>`;

  return uploadSvg(svg, `marcus-${Date.now()}.svg`);
}

// ── Elena Voss ────────────────────────────────────────────────────────────────

export async function generateElenaCover(
  data:    ElenaDataPull,
  topic:   string | null,
  signal:  string | null
): Promise<ReturnType<typeof uploadSvg>> {
  const isInverted = data.yieldCurveSpread < 0;
  const curveColor = isInverted ? '#f87171' : '#a78bfa';

  function macroCell(label: string, value: string, unit: string, change: string | null, color: string, cx: number, cy: number): string {
    const changeColor = change?.startsWith('+') ? '#34d399' : change?.startsWith('-') ? '#f87171' : '#71717a';
    return `
      <rect x="${cx}" y="${cy}" width="340" height="100" rx="8" fill="#0d0d10" stroke="#1f1f23"/>
      <text x="${cx + 18}" y="${cy + 30}" font-family="system-ui,-apple-system,sans-serif" font-size="11" fill="#52525b" letter-spacing="1">${label.toUpperCase()}</text>
      <text x="${cx + 18}" y="${cy + 68}" font-family="system-ui,-apple-system,sans-serif" font-size="34" font-weight="900" fill="${color}">${value}<tspan font-size="18" fill="#71717a">${unit}</tspan></text>
      ${change ? `<text x="${cx + 316}" y="${cy + 30}" text-anchor="end" font-family="system-ui,-apple-system,sans-serif" font-size="14" font-weight="700" fill="${changeColor}">${change}</text>` : ''}`;
  }

  const spread = data.yieldCurveSpread.toFixed(2);
  const spreadSign = data.yieldCurveSpread > 0 ? '+' : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bg()}
    ${grid()}

    <!-- Header -->
    <text x="60" y="72" font-family="system-ui,-apple-system,sans-serif" font-size="12" font-weight="700" letter-spacing="3" fill="#a78bfa">MACRO SIGNAL</text>
    <text x="60" y="115" font-family="system-ui,-apple-system,sans-serif" font-size="36" font-weight="900" fill="white">${topic ?? signal ?? 'Macro Update'}</text>

    <!-- Macro metrics grid 2×3 -->
    ${macroCell('Fed Funds Rate', data.fedFundsRate.toFixed(2), '%', null, '#a78bfa', 60, 140)}
    ${macroCell('CPI YoY', data.cpiYoY.toFixed(2), '%', null, '#d4d4d8', 420, 140)}
    ${macroCell('Core PCE', data.corePce.toFixed(2), '%', null, '#d4d4d8', 780, 140)}
    ${macroCell('10Y Treasury', data.tenYearYield.toFixed(2), '%', null, '#d4d4d8', 60, 258)}
    ${macroCell('2Y Treasury', data.twoYearYield.toFixed(2), '%', null, '#d4d4d8', 420, 258)}

    <!-- Yield curve spread — featured -->
    <rect x="780" y="258" width="340" height="100" rx="8" fill="#0d0d10" stroke="${curveColor}" stroke-width="1.5"/>
    <text x="798" y="288" font-family="system-ui,-apple-system,sans-serif" font-size="11" fill="#52525b" letter-spacing="1">YIELD CURVE (10Y-2Y)</text>
    <text x="798" y="328" font-family="system-ui,-apple-system,sans-serif" font-size="34" font-weight="900" fill="${curveColor}">${spreadSign}${spread}<tspan font-size="18" fill="#71717a">%</tspan></text>
    <text x="1102" y="290" text-anchor="end" font-family="system-ui,-apple-system,sans-serif" font-size="14" font-weight="700" fill="${curveColor}">${isInverted ? 'INVERTED' : 'NORMAL'}</text>

    <!-- USD Broad Index -->
    <rect x="60" y="376" width="520" height="58" rx="8" fill="#0d0d10" stroke="#1f1f23"/>
    <text x="80" y="400" font-family="system-ui,-apple-system,sans-serif" font-size="11" fill="#52525b" letter-spacing="1">USD BROAD INDEX (DTWEXBGS)</text>
    <text x="80" y="422" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="700" fill="#d4d4d8">${data.dxyIndex.toFixed(2)}</text>

    <!-- BTC 24h -->
    <rect x="600" y="376" width="520" height="58" rx="8" fill="#0d0d10" stroke="#1f1f23"/>
    <text x="620" y="400" font-family="system-ui,-apple-system,sans-serif" font-size="11" fill="#52525b" letter-spacing="1">BTC 24H CHANGE</text>
    <text x="620" y="422" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="700" fill="${data.btcChange24h >= 0 ? '#34d399' : '#f87171'}">${data.btcChange24h >= 0 ? '+' : ''}${data.btcChange24h.toFixed(2)}%</text>

    ${personaFooter('Elena Voss', 'Macro Bear', '#a78bfa')}
  </svg>`;

  return uploadSvg(svg, `elena-${Date.now()}.svg`);
}

// ── Leo Cruz ──────────────────────────────────────────────────────────────────

export async function generateLeoCover(
  data:           LeoDataPull,
  narrativeName:  string,
  narrativeStage: string,
  narrative:      NarrativeState | null
): Promise<ReturnType<typeof uploadSvg>> {
  const stages = ['emerging', 'growing', 'peak', 'fading'];
  const stageIdx = stages.indexOf(narrativeStage);
  const stageLabels = ['Emerging', 'Growing', 'Peak', 'Fading'];
  const stageColors = ['#22d3ee', '#34d399', '#fb923c', '#f87171'];

  const currentColor = stageColors[stageIdx] ?? '#fb923c';

  // Cycle stages as horizontal progress
  const stagesViz = stages.map((s, i) => {
    const isActive = i === stageIdx;
    const isPast   = i < stageIdx;
    const col = isPast ? '#27272a' : isActive ? currentColor : '#1a1a1e';
    const textCol = isPast ? '#3f3f46' : isActive ? '#09090b' : '#52525b';
    const x = 60 + i * 270;
    return `
      <rect x="${x}" y="280" width="250" height="52" rx="26" fill="${col}"/>
      <text x="${x + 125}" y="312" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="15" font-weight="${isActive ? '800' : '600'}" fill="${textCol}">${stageLabels[i]}</text>
      ${i < stages.length - 1 ? `<text x="${x + 261}" y="313" font-family="system-ui,-apple-system,sans-serif" font-size="18" fill="#27272a">›</text>` : ''}`;
  }).join('');

  // Top trending coins
  const trending = data.trendingCoins.slice(0, 5).map((c, i) => `
    <rect x="${60 + i * 220}" y="370" width="200" height="36" rx="18" fill="#0f0f11" stroke="#1f1f23"/>
    <text x="${160 + i * 220}" y="394" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="13" font-weight="600" fill="#a1a1aa">${c.symbol} · ${c.name}</text>`
  ).join('');

  const peakScoreBar = narrative?.peakScore ? `
    <text x="60" y="440" font-family="system-ui,-apple-system,sans-serif" font-size="11" fill="#52525b" letter-spacing="1">PEAK SCORE</text>
    <rect x="60" y="450" width="400" height="6" rx="3" fill="#1f1f23"/>
    <rect x="60" y="450" width="${Math.min(400, narrative.peakScore * 4)}" height="6" rx="3" fill="${currentColor}"/>` : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bg()}
    ${grid()}

    <!-- Narrative label -->
    <text x="60" y="80" font-family="system-ui,-apple-system,sans-serif" font-size="12" font-weight="700" letter-spacing="3" fill="${currentColor}">NARRATIVE ALERT</text>

    <!-- Narrative name — large -->
    <text x="60" y="180" font-family="system-ui,-apple-system,sans-serif" font-size="72" font-weight="900" fill="white">${narrativeName.slice(0, 22)}</text>

    <!-- Stage label -->
    <rect x="60" y="200" width="${100 + stageLabels[stageIdx]?.length * 11}" height="32" rx="16" fill="${currentColor}"/>
    <text x="${70 + (stageLabels[stageIdx]?.length * 11) / 2}" y="222" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="14" font-weight="800" fill="#09090b">${stageLabels[stageIdx] ?? 'Growing'}</text>

    <!-- Narrative cycle -->
    ${stagesViz}

    <!-- Trending coins -->
    ${trending}

    <!-- Fear & Greed -->
    ${fearGreedArc(data.fearGreedCurrent, 1040, 165, 90)}

    ${peakScoreBar}

    ${personaFooter('Leo Cruz', 'Narrative Hunter', currentColor)}
  </svg>`;

  return uploadSvg(svg, `leo-${Date.now()}.svg`);
}
