"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeedbackRecord {
  id:           string;
  persona_id:   string;
  article_slug: string | null;
  score:        number | null;
  strengths:    string[];
  priority_fix: string;
  directive:    string;
  pattern_warn: string | null;
}

interface Session {
  id:           string;
  session_date: string;
  ran_at:       string | null;
  desk_note:    string | null;
  raw_output?:  Record<string, unknown>;
  editorial_feedback: FeedbackRecord[];
}

interface PersonaSeries {
  id:            string;
  name:          string;
  color:         string;
  scores:        (number | null)[];
  article_slugs: (string | null)[];
  avg:           number | null;
}

interface ScoreData {
  dates:   string[];
  personas: PersonaSeries[];
}

interface Directive {
  id:                  string;
  persona_id:          string;
  directive:           string;
  issued_date:         string;
  target_article_slug: string | null;
  status:              'pending' | 'resolved' | 'missed';
  resolved_at:         string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PERSONAS: Record<string, { name: string; color: string; dot: string }> = {
  'elena-voss':  { name: 'Elena Voss',  color: 'text-violet-400', dot: 'bg-violet-400' },
  'marcus-webb': { name: 'Marcus Webb', color: 'text-teal-400',   dot: 'bg-teal-400'   },
  'leo-cruz':    { name: 'Leo Cruz',    color: 'text-orange-400', dot: 'bg-orange-400' },
};

const CHART_COLORS: Record<string, string> = {
  'elena-voss':  '#a78bfa',
  'marcus-webb': '#2dd4bf',
  'leo-cruz':    '#fb923c',
};

// ── Score Chart ───────────────────────────────────────────────────────────────

function ScoreChart({ data }: { data: ScoreData }) {
  const W = 560, H = 160, PL = 28, PR = 8, PT = 8, PB = 24;
  const cW = W - PL - PR;
  const cH = H - PT - PB;
  const n  = data.dates.length;

  const scoreToY = (s: number) => PT + (1 - s / 100) * cH;
  const idxToX   = (i: number) => PL + (n <= 1 ? cW / 2 : (i / (n - 1)) * cW);

  function buildPath(scores: (number | null)[]) {
    let d = '';
    scores.forEach((s, i) => {
      if (s === null) return;
      const x = idxToX(i).toFixed(1);
      const y = scoreToY(s).toFixed(1);
      d += (d === '' || scores[i - 1] === null) ? `M${x} ${y}` : ` L${x} ${y}`;
    });
    return d;
  }

  // Show ~4-5 date labels
  const labelStep = Math.max(1, Math.floor(n / 5));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 180 }}>
      {/* Grid */}
      {[0, 25, 50, 75, 100].map(v => (
        <line key={v} x1={PL} x2={W - PR} y1={scoreToY(v)} y2={scoreToY(v)}
          stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      ))}
      {/* Y labels */}
      {[0, 50, 100].map(v => (
        <text key={v} x={PL - 4} y={scoreToY(v) + 4} textAnchor="end"
          fontSize="9" fill="rgb(82,82,91)">{v}</text>
      ))}
      {/* X labels */}
      {data.dates.map((date, i) => {
        if (i % labelStep !== 0 && i !== n - 1) return null;
        return (
          <text key={date} x={idxToX(i)} y={H - 4} textAnchor="middle"
            fontSize="9" fill="rgb(82,82,91)">{date.slice(5)}</text>
        );
      })}
      {/* Lines */}
      {data.personas.map(p => (
        <path key={p.id} d={buildPath(p.scores)} stroke={CHART_COLORS[p.id] ?? '#fff'}
          strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {/* Dots */}
      {data.personas.flatMap(p =>
        p.scores.map((s, i) => s === null ? null : (
          <circle key={`${p.id}-${i}`} cx={idxToX(i)} cy={scoreToY(s)} r="3"
            fill={CHART_COLORS[p.id] ?? '#fff'}>
            <title>{data.dates[i]} · {PERSONAS[p.id]?.name ?? p.id} · {s}/100{p.article_slugs[i] ? ` · ${p.article_slugs[i]}` : ''}</title>
          </circle>
        ))
      )}
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EditorialDeskTab() {
  const [sessions,    setSessions]    = useState<Session[]>([]);
  const [scores,      setScores]      = useState<ScoreData | null>(null);
  const [directives,  setDirectives]  = useState<Directive[]>([]);
  const [chartDays,   setChartDays]   = useState<7 | 14 | 30>(14);
  const [filter,      setFilter]      = useState<'all' | 'elena-voss' | 'marcus-webb' | 'leo-cruz'>('all');
  const [running,     setRunning]     = useState(false);
  const [runResult,   setRunResult]   = useState<string | null>(null);
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);

  const today = new Date().toISOString().slice(0, 10);
  const latest = sessions[0] ?? null;

  const load = useCallback(async (days = chartDays) => {
    setLoading(true);
    const [sessRes, scoresRes, dirRes] = await Promise.all([
      fetch('/api/admin/editorial/sessions').then(r => r.json()),
      fetch(`/api/admin/editorial/scores?days=${days}`).then(r => r.json()),
      fetch('/api/admin/editorial/directives').then(r => r.json()),
    ]);
    setSessions((sessRes.sessions ?? []) as Session[]);
    setScores(scoresRes as ScoreData);
    setDirectives((dirRes.directives ?? []) as Directive[]);
    setLoading(false);
  }, [chartDays]);

  useEffect(() => { void load(); }, [load]);

  async function handleRun() {
    setRunning(true); setRunResult(null);
    const res  = await fetch('/api/admin/editorial/run', { method: 'POST' });
    const data = await res.json() as { ran?: boolean; reason?: string; deskNote?: string };
    setRunResult(data.ran ? `✓ ${data.deskNote ?? 'Session complete'}` : `— ${data.reason ?? 'No result'}`);
    setRunning(false);
    await load();
  }

  async function patchDirective(id: string, status: 'resolved' | 'missed') {
    await fetch('/api/admin/editorial/directives', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    setDirectives(prev => prev.map(d => d.id === id ? { ...d, status, resolved_at: new Date().toISOString() } : d));
  }

  // Session status
  const ranToday = latest?.session_date === today;
  const hour = new Date().getUTCHours();
  const statusBadge = ranToday
    ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">Ran today</span>
    : hour < 21
      ? <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-500">Scheduled 21:00 UTC</span>
      : <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">Missed</span>;

  const todayFeedback = latest?.session_date === today ? (latest.editorial_feedback ?? []) : [];
  const filteredFeedback = filter === 'all' ? todayFeedback : todayFeedback.filter(f => f.persona_id === filter);

  return (
    <div className="space-y-8">

      {/* ── S1: Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Editorial Desk</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Victor Kane · Chief Editor
            {latest?.ran_at && (
              <span className="ml-3 text-zinc-600">
                Last session: {new Date(latest.ran_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {statusBadge}
          <button onClick={handleRun} disabled={running}
            className="flex items-center gap-2 rounded-lg border border-amber-400/30 px-4 py-2 text-sm font-bold text-amber-300 transition hover:border-amber-400/60 disabled:cursor-wait disabled:opacity-40">
            {running && <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            {running ? 'Running…' : '▶ Run now'}
          </button>
        </div>
      </div>
      {runResult && <p className={`-mt-4 text-sm ${runResult.startsWith('✓') ? 'text-emerald-400' : 'text-zinc-500'}`}>{runResult}</p>}

      {loading && <div className="h-32 animate-pulse rounded-xl bg-white/[0.03]" />}

      {!loading && (<>

      {/* ── S2: Score cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Object.entries(PERSONAS).map(([pid, { name, color, dot }]) => {
          const p = scores?.personas.find(x => x.id === pid);
          const fb = todayFeedback.find(f => f.persona_id === pid);
          const score = fb?.score ?? null;
          const yesterday = scores?.personas.find(x => x.id === pid)?.scores.slice(-2, -1)[0] ?? null;
          const delta = (score !== null && yesterday !== null) ? score - yesterday : null;
          return (
            <div key={pid} className={`rounded-xl border p-5 ${score === null ? 'border-white/[0.04] opacity-50' : 'border-white/[0.06] bg-zinc-900/40'}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`h-2 w-2 rounded-full ${dot}`} />
                <span className={`text-sm font-bold ${color}`}>{name}</span>
              </div>
              {score !== null ? (
                <>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-white tabular-nums">{score}</span>
                    <span className="mb-1 text-lg text-zinc-600">/100</span>
                    {delta !== null && (
                      <span className={`mb-1 text-sm font-bold ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-zinc-600'}`}>
                        {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'} {Math.abs(delta)}
                      </span>
                    )}
                  </div>
                  {p?.avg !== null && p?.avg !== undefined && (
                    <p className="mt-1 text-[11px] text-zinc-600">14d avg: {p.avg}</p>
                  )}
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div className={`h-full rounded-full ${dot}`} style={{ width: `${score}%` }} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-600 mt-2">Did not publish today</p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── S3: Score dynamics ── */}
      {scores && (
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-white">Score dynamics</p>
            <div className="flex gap-3">
              {/* Legend */}
              {Object.entries(PERSONAS).map(([pid, { name, dot }]) => (
                <span key={pid} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                  <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                  {name.split(' ')[0]}
                </span>
              ))}
            </div>
          </div>
          <ScoreChart data={scores} />
          <div className="mt-3 flex gap-2">
            {([7, 14, 30] as const).map(d => (
              <button key={d} onClick={() => { setChartDays(d); void load(d); }}
                className={`rounded px-2.5 py-1 text-xs font-bold transition ${chartDays === d ? 'bg-white/[0.08] text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── S4: Today's session ── */}
      {todayFeedback.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-bold text-white">Today&apos;s session</p>
            <div className="flex gap-1">
              {(['all', 'elena-voss', 'marcus-webb', 'leo-cruz'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`rounded px-2.5 py-1 text-xs font-semibold transition ${filter === f ? 'bg-white/[0.08] text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>
                  {f === 'all' ? 'All' : PERSONAS[f]?.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {filteredFeedback.map(fb => {
              const p = PERSONAS[fb.persona_id];
              return (
                <div key={fb.id} className="rounded-xl border border-white/[0.06] bg-zinc-900/40 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
                    <div className="flex items-center gap-3">
                      <span className={`h-2 w-2 rounded-full ${p?.dot}`} />
                      <span className={`text-sm font-bold ${p?.color}`}>{p?.name}</span>
                      {fb.article_slug && (
                        <a href={`/crypto/${fb.article_slug}`} target="_blank"
                          className="text-xs text-zinc-600 italic hover:text-zinc-400">
                          {fb.article_slug}
                        </a>
                      )}
                    </div>
                    {fb.score !== null && (
                      <span className={`rounded-full px-3 py-1 text-sm font-black tabular-nums ${
                        fb.score >= 80 ? 'bg-emerald-500/15 text-emerald-400' :
                        fb.score >= 65 ? 'bg-amber-500/15 text-amber-400' :
                        'bg-red-500/15 text-red-400'
                      }`}>{fb.score}/100</span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-3">
                    {/* Strengths */}
                    {fb.strengths?.length > 0 && (
                      <div className="border-l-2 border-emerald-500/40 pl-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500/70 mb-1">Strengths</p>
                        {fb.strengths.map((s, i) => (
                          <p key={i} className="text-xs text-zinc-300">{s}</p>
                        ))}
                      </div>
                    )}

                    {/* Priority fix */}
                    {fb.priority_fix && (
                      <div className="border-l-2 border-red-500/40 pl-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-red-500/70 mb-1">Priority fix</p>
                        <p className="text-xs text-zinc-300">{fb.priority_fix}</p>
                      </div>
                    )}

                    {/* Directive */}
                    {fb.directive && (
                      <div className="border-l-2 border-zinc-600 pl-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Directive</p>
                        <p className="text-xs text-zinc-400 italic">{fb.directive}</p>
                      </div>
                    )}

                    {/* Pattern warning */}
                    {fb.pattern_warn && (
                      <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2">
                        <span className="text-amber-400 text-sm flex-shrink-0">⚠</span>
                        <p className="text-xs text-amber-300">{fb.pattern_warn}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── S5: Desk note ── */}
      {latest?.desk_note && (
        <div className="border-l-2 border-amber-400/30 pl-5">
          <p className="text-sm italic leading-6 text-zinc-300">&ldquo;{latest.desk_note}&rdquo;</p>
          <p className="mt-2 text-[11px] text-zinc-600">
            Victor Kane · {latest.ran_at ? new Date(latest.ran_at).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : ''}
          </p>
        </div>
      )}

      {/* ── S6: Directive tracker ── */}
      {directives.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.04]">
            <p className="text-sm font-bold text-white">Directive tracker</p>
            <p className="text-xs text-zinc-600 mt-0.5">Did the analysts act on feedback?</p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {['Analyst','Directive','Issued','Status',''].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {directives.slice(0, 20).map(d => {
                const p = PERSONAS[d.persona_id];
                return (
                  <tr key={d.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${p?.dot ?? 'bg-zinc-600'}`} />
                        <span className={p?.color ?? 'text-zinc-400'}>{p?.name.split(' ')[0] ?? d.persona_id}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 max-w-[240px] text-zinc-400 truncate" title={d.directive}>{d.directive}</td>
                    <td className="px-4 py-2.5 text-zinc-600">{d.issued_date}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        d.status === 'resolved' ? 'bg-emerald-500/15 text-emerald-400' :
                        d.status === 'missed'   ? 'bg-red-500/15 text-red-400' :
                        'bg-zinc-800 text-zinc-500'
                      }`}>{d.status}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {d.status === 'pending' && (
                        <div className="flex gap-1">
                          <button onClick={() => patchDirective(d.id, 'resolved')} className="rounded px-1.5 py-0.5 text-[10px] text-emerald-600 hover:text-emerald-400 border border-emerald-600/20">✓</button>
                          <button onClick={() => patchDirective(d.id, 'missed')} className="rounded px-1.5 py-0.5 text-[10px] text-red-600 hover:text-red-400 border border-red-600/20">✗</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── S7: Session log ── */}
      {sessions.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.04]">
            <p className="text-sm font-bold text-white">Session log</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {sessions.map(s => {
              const avgScore = s.editorial_feedback?.length > 0
                ? Math.round(s.editorial_feedback.reduce((a, f) => a + (f.score ?? 0), 0) / s.editorial_feedback.length)
                : null;
              const isOpen = expanded === s.session_date;
              return (
                <div key={s.session_date}>
                  <button onClick={() => setExpanded(isOpen ? null : s.session_date)}
                    className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-white/[0.02] transition">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-semibold text-zinc-300">{s.session_date}</span>
                      <span className="text-zinc-600">{s.editorial_feedback?.length ?? 0} analyst{s.editorial_feedback?.length !== 1 ? 's' : ''}</span>
                      {avgScore !== null && (
                        <span className={`font-bold ${avgScore >= 75 ? 'text-emerald-400' : avgScore >= 60 ? 'text-amber-400' : 'text-zinc-400'}`}>avg {avgScore}</span>
                      )}
                    </div>
                    <span className="text-xs text-zinc-700">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4">
                      {s.desk_note && <p className="text-xs text-zinc-500 italic mb-3">&ldquo;{s.desk_note}&rdquo;</p>}
                      <pre className="max-h-64 overflow-y-auto rounded-lg bg-zinc-950 p-3 text-[10px] leading-5 text-zinc-400">
                        {JSON.stringify(s.raw_output ?? s, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 px-6 py-12 text-center">
          <p className="text-sm text-zinc-600">No sessions yet. Click &ldquo;Run now&rdquo; to start the first session.</p>
        </div>
      )}

      </>)}
    </div>
  );
}
