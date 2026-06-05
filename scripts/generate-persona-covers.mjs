/**
 * Generate and attach data visualization cover images for already-published persona articles.
 * Uses data_snapshot from persona_runs to reconstruct the data at publication time.
 *
 * Usage:
 *   node --env-file=.env.local scripts/generate-persona-covers.mjs
 *   node --env-file=.env.local scripts/generate-persona-covers.mjs elena-voss
 *   node --env-file=.env.local scripts/generate-persona-covers.mjs --dry-run
 */

import { createClient } from '@sanity/client';
import { createClient as createSupabase } from '@supabase/supabase-js';

const personaFilter = process.argv[2]?.startsWith('--') ? null : process.argv[2] ?? null;
const dryRun = process.argv.includes('--dry-run');

const SANITY = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset:   process.env.SANITY_DATASET ?? 'production',
  token:     process.env.SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false,
});

const DB = createSupabase(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PERSONAS = ['elena-voss', 'marcus-webb', 'leo-cruz'];
const targets  = personaFilter ? [personaFilter] : PERSONAS;

// ── 1. Fetch articles without coverImage ──────────────────────────────────────

async function fetchArticlesWithoutCover(personaId) {
  return SANITY.fetch(
    `*[_type == "article" && persona == $p && !defined(coverImage)] | order(publishedAt desc) {
       _id, "slug": slug.current, persona, publishedAt,
       "title": translations.en.title,
       "excerpt": translations.en.excerpt
     }`,
    { p: personaId }
  );
}

// ── 2. Find data_snapshot from persona_runs ───────────────────────────────────

async function getDataSnapshot(personaId, articleSlug) {
  const { data } = await DB
    .from('persona_runs')
    .select('data_snapshot, created_at')
    .eq('persona_id', personaId)
    .eq('article_slug', articleSlug)
    .limit(1);
  return data?.[0]?.data_snapshot ?? null;
}

// ── 3. SVG generators (inline, no TypeScript imports needed) ─────────────────

const W = 1200, H = 630;

function bg()   { return `<rect width="${W}" height="${H}" fill="#09090b"/>`; }
function grid() {
  const l = [];
  for (let x = 0; x <= W; x += 120) l.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#18181b" stroke-width="1"/>`);
  for (let y = 0; y <= H; y += 90)  l.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#18181b" stroke-width="1"/>`);
  return `<g opacity="0.6">${l.join('')}</g>`;
}
function footer(name, role, color) {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `
    <line x1="60" y1="${H - 56}" x2="${W - 60}" y2="${H - 56}" stroke="#27272a" stroke-width="1"/>
    <text x="60" y="${H - 24}" font-family="system-ui,sans-serif" font-size="18" font-weight="700" fill="${color}">${name}</text>
    <text x="60" y="${H - 6}"  font-family="system-ui,sans-serif" font-size="14" fill="#52525b">${role} · finc.news</text>
    <text x="${W - 60}" y="${H - 12}" text-anchor="end" font-family="system-ui,sans-serif" font-size="13" fill="#3f3f46">${date}</text>`;
}

function marcusSvg(snap, title) {
  const d = snap ?? {};
  const metrics = [
    ['Exchange Netflow', (d.btcExchangeNetflow ?? 0).toFixed(0) + ' BTC', '#2dd4bf'],
    ['BTC Price', '$' + (d.btcPrice ?? 0).toLocaleString(), '#d4d4d8'],
    ['Hashrate', ((d.btcHashrate ?? 0) / 1e6).toFixed(2) + ' EH/s', '#d4d4d8'],
    ['Mempool Tx', (d.mempoolTxCount ?? 0).toLocaleString(), '#d4d4d8'],
    ['Fear & Greed', (d.fearGreedIndex ?? 50) + '/100', '#d4d4d8'],
    ['Volume Ratio', (d.btcVolumeRatio ?? 1).toFixed(2) + 'x avg', '#d4d4d8'],
  ];
  const cells = metrics.map(([label, value, color], i) => {
    const cx = 60 + (i % 3) * 380;
    const cy = 140 + Math.floor(i / 3) * 115;
    return `
      <rect x="${cx}" y="${cy}" width="360" height="100" rx="8" fill="#0d0d10" stroke="#1f1f23"/>
      <text x="${cx + 16}" y="${cy + 28}" font-family="system-ui,sans-serif" font-size="11" fill="#52525b" letter-spacing="1">${label.toUpperCase()}</text>
      <text x="${cx + 16}" y="${cy + 68}" font-family="system-ui,sans-serif" font-size="30" font-weight="900" fill="${color}">${value}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bg()}${grid()}
    <text x="60" y="80" font-family="system-ui,sans-serif" font-size="12" font-weight="700" letter-spacing="3" fill="#2dd4bf">ON-CHAIN SNAPSHOT</text>
    <text x="60" y="118" font-family="system-ui,sans-serif" font-size="30" font-weight="900" fill="white">${(title ?? '').slice(0, 55)}</text>
    ${cells}
    ${footer('Marcus Webb', 'On-Chain Analyst', '#2dd4bf')}
  </svg>`;
}

function elenaSvg(snap, title) {
  const d = snap ?? {};
  const spread = ((d.tenYearYield ?? 0) - (d.twoYearYield ?? 0)).toFixed(2);
  const isInverted = parseFloat(spread) < 0;
  const curveColor = isInverted ? '#f87171' : '#a78bfa';

  function cell(label, value, color, cx, cy) {
    return `
      <rect x="${cx}" y="${cy}" width="340" height="100" rx="8" fill="#0d0d10" stroke="#1f1f23"/>
      <text x="${cx + 18}" y="${cy + 30}" font-family="system-ui,sans-serif" font-size="11" fill="#52525b" letter-spacing="1">${label.toUpperCase()}</text>
      <text x="${cx + 18}" y="${cy + 68}" font-family="system-ui,sans-serif" font-size="34" font-weight="900" fill="${color}">${value}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bg()}${grid()}
    <text x="60" y="80" font-family="system-ui,sans-serif" font-size="12" font-weight="700" letter-spacing="3" fill="#a78bfa">MACRO SIGNAL</text>
    <text x="60" y="118" font-family="system-ui,sans-serif" font-size="30" font-weight="900" fill="white">${(title ?? '').slice(0, 55)}</text>
    ${cell('Fed Funds Rate', (d.fedFundsRate ?? 0).toFixed(2) + '%',  '#a78bfa', 60,  148)}
    ${cell('CPI YoY',        (d.cpiYoY ?? 0).toFixed(2) + '%',       '#d4d4d8', 420, 148)}
    ${cell('Core PCE',       (d.corePce ?? 0).toFixed(2) + '%',      '#d4d4d8', 780, 148)}
    ${cell('10Y Treasury',   (d.tenYearYield ?? 0).toFixed(2) + '%', '#d4d4d8', 60,  266)}
    ${cell('2Y Treasury',    (d.twoYearYield ?? 0).toFixed(2) + '%', '#d4d4d8', 420, 266)}
    <rect x="780" y="266" width="340" height="100" rx="8" fill="#0d0d10" stroke="${curveColor}" stroke-width="1.5"/>
    <text x="798" y="296" font-family="system-ui,sans-serif" font-size="11" fill="#52525b" letter-spacing="1">YIELD CURVE (10Y-2Y)</text>
    <text x="798" y="334" font-family="system-ui,sans-serif" font-size="34" font-weight="900" fill="${curveColor}">${parseFloat(spread) > 0 ? '+' : ''}${spread}%</text>
    <text x="1102" y="296" text-anchor="end" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="${curveColor}">${isInverted ? 'INVERTED' : 'NORMAL'}</text>
    ${footer('Elena Voss', 'Macro Bear', '#a78bfa')}
  </svg>`;
}

function leoSvg(snap, title) {
  const d  = snap ?? {};
  const fg = d.fearGreedCurrent ?? 50;
  const coins = (d.trendingCoins ?? []).slice(0, 5);

  const fgColor = fg <= 25 ? '#f87171' : fg <= 45 ? '#fb923c' : fg >= 75 ? '#34d399' : fg >= 55 ? '#22d3ee' : '#71717a';
  const angle   = Math.PI * (1 - fg / 100);
  const cx = 1040, cy = 165, r = 90;
  const vx = (cx + r * Math.cos(angle)).toFixed(1);
  const vy = (cy - r * Math.sin(angle)).toFixed(1);

  const coinBadges = coins.map((c, i) => {
    const bx = 60 + i * 220;
    return `
      <rect x="${bx}" y="370" width="200" height="36" rx="18" fill="#0f0f11" stroke="#1f1f23"/>
      <text x="${bx + 100}" y="394" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="#a1a1aa">${c.symbol ?? ''} · ${c.name ?? ''}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bg()}${grid()}
    <text x="60" y="80" font-family="system-ui,sans-serif" font-size="12" font-weight="700" letter-spacing="3" fill="#fb923c">NARRATIVE ALERT</text>
    <text x="60" y="175" font-family="system-ui,sans-serif" font-size="64" font-weight="900" fill="white">${(title ?? '').slice(0, 24)}</text>
    <!-- Cycle stages -->
    ${['Emerging','Growing','Peak','Fading'].map((s, i) => {
      const active = i === 2; // default to peak for archived
      const cx2 = 60 + i * 270;
      return `<rect x="${cx2}" y="220" width="250" height="48" rx="24" fill="${active ? '#fb923c' : '#1a1a1e'}"/>
        <text x="${cx2 + 125}" y="250" text-anchor="middle" font-family="system-ui,sans-serif" font-size="15" font-weight="${active ? '800' : '600'}" fill="${active ? '#09090b' : '#52525b'}">${s}</text>
        ${i < 3 ? `<text x="${cx2 + 261}" y="251" font-family="system-ui,sans-serif" font-size="18" fill="#27272a">›</text>` : ''}`;
    }).join('')}
    ${coinBadges}
    <!-- Fear & Greed -->
    <path d="M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}" fill="none" stroke="#27272a" stroke-width="14" stroke-linecap="round"/>
    <path d="M ${cx - r},${cy} A ${r},${r} 0 0 1 ${vx},${vy}" fill="none" stroke="${fgColor}" stroke-width="14" stroke-linecap="round"/>
    <circle cx="${vx}" cy="${vy}" r="9" fill="${fgColor}"/>
    <text x="${cx}" y="${cy + 28}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="32" font-weight="900" fill="white">${fg}</text>
    <text x="${cx}" y="${cy + 50}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="${fgColor}">Fear &amp; Greed</text>
    ${footer('Leo Cruz', 'Narrative Hunter', '#fb923c')}
  </svg>`;
}

function buildSvg(personaId, snap, title) {
  switch (personaId) {
    case 'marcus-webb': return marcusSvg(snap, title);
    case 'elena-voss':  return elenaSvg(snap, title);
    case 'leo-cruz':    return leoSvg(snap, title);
    default: return null;
  }
}

// ── 4. Upload SVG to Sanity ───────────────────────────────────────────────────

async function uploadSvg(svg, filename) {
  const buf   = Buffer.from(svg, 'utf-8');
  const asset = await SANITY.assets.upload('image', buf, { filename, contentType: 'image/svg+xml' });
  return { _type: 'image', asset: { _type: 'reference', _ref: asset._id } };
}

// ── Main ──────────────────────────────────────────────────────────────────────

let total = 0, patched = 0, skipped = 0;

for (const personaId of targets) {
  console.log(`\n── ${personaId} ──`);
  const articles = await fetchArticlesWithoutCover(personaId);
  console.log(`  Found ${articles.length} articles without cover`);

  for (const article of articles) {
    total++;
    const snap = await getDataSnapshot(personaId, article.slug);
    if (!snap) {
      console.log(`  ⟳ ${article.slug} — no data_snapshot, skipping`);
      skipped++;
      continue;
    }

    const svg = buildSvg(personaId, snap, article.title ?? article.slug);
    if (!svg) { skipped++; continue; }

    if (dryRun) {
      console.log(`  ✓ [dry-run] ${article.slug}`);
      patched++;
      continue;
    }

    try {
      const coverImage = await uploadSvg(svg, `${personaId}-${article.slug}.svg`);
      await SANITY.patch(article._id).set({ coverImage }).commit();
      console.log(`  ✓ ${article.slug}`);
      patched++;
    } catch (err) {
      console.error(`  ✗ ${article.slug}: ${err.message}`);
      skipped++;
    }
  }
}

console.log(`\n── Done: ${patched} patched, ${skipped} skipped of ${total} total ──`);
