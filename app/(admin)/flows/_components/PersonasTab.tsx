"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";

type PipelineStep = "data-pull" | "should-write" | "generate" | "self-work" | "run";

interface StepState {
  status: "idle" | "loading" | "ok" | "error" | "skipped";
  result: unknown;
  durationMs?: number;
}

interface PersonaRun {
  id: string;
  run_date: string;
  should_write: boolean;
  score: number;
  reasoning: string;
  topic: string | null;
  primary_signal: string | null;
  article_slug: string | null;
  created_at: string;
}

interface ContextLayer { label: string; content: string; empty: boolean; }

const STEPS: { key: PipelineStep; label: string; desc: string; color: string }[] = [
  { key: "data-pull",   label: "Pull Data",     desc: "Fetch live data from all sources", color: "border-sky-400/30 text-sky-300 hover:border-sky-400/60" },
  { key: "should-write",label: "Evaluate",      desc: "Editorial judgment (0-100)",        color: "border-violet-400/30 text-violet-300 hover:border-violet-400/60" },
  { key: "generate",    label: "Dry Generate",  desc: "Generate article, no publish",      color: "border-amber-400/30 text-amber-300 hover:border-amber-400/60" },
  { key: "self-work",   label: "Self-Work",     desc: "Bootstrap / weekly / tracker",      color: "border-rose-400/30 text-rose-300 hover:border-rose-400/60" },
  { key: "run",         label: "▶ Full Run",    desc: "Full pipeline with publish",         color: "bg-emerald-500 text-zinc-950 border-transparent hover:bg-emerald-400" },
];

// ── PersonaCard ───────────────────────────────────────────────────────────────

interface PersonaCardProps {
  personaId:  string;
  name:       string;
  role:       string;
  avatar:     string;
  sources:    string;
  cronTime:   string;
}

function PersonaCard({ personaId, name, role, avatar, sources, cronTime }: PersonaCardProps) {
  const [steps, setSteps] = useState<Record<PipelineStep, StepState>>({
    "data-pull":    { status: "idle", result: null },
    "should-write": { status: "idle", result: null },
    generate:       { status: "idle", result: null },
    "self-work":    { status: "idle", result: null },
    run:            { status: "idle", result: null },
  });
  const [activeStep, setActiveStep]       = useState<PipelineStep | null>(null);
  const [isActive, setIsActive]           = useState<boolean | null>(null);
  const [recentRuns, setRecentRuns]       = useState<PersonaRun[]>([]);
  const [runsLoaded, setRunsLoaded]       = useState(false);
  const [contextLayers, setContextLayers] = useState<ContextLayer[] | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextTopic, setContextTopic]   = useState("");

  // Load actual is_active status from DB on mount
  useEffect(() => {
    fetch(`/api/admin/personas/${personaId}`)
      .then((r) => r.json())
      .then((d: { persona?: { is_active: boolean } }) => {
        if (d.persona?.is_active !== undefined) setIsActive(d.persona.is_active);
      })
      .catch(() => {/* best-effort */});
  }, [personaId]);

  const setStep = useCallback((key: PipelineStep, patch: Partial<StepState>) => {
    setSteps((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }, []);

  async function runStep(step: PipelineStep) {
    setActiveStep(step);
    setStep(step, { status: "loading", result: null });
    const t0 = Date.now();
    try {
      const res = await fetch(`/api/admin/personas/${personaId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: step }),
        signal: AbortSignal.timeout(65000),
      });
      const data = await res.json() as Record<string, unknown>;
      const ms = Date.now() - t0;
      if (!res.ok || data.error) setStep(step, { status: "error",   result: data.error ?? data, durationMs: ms });
      else if (data.skipped)     setStep(step, { status: "skipped", result: data,                durationMs: ms });
      else                       setStep(step, { status: "ok",      result: data,                durationMs: ms });
    } catch (e) {
      setStep(step, { status: "error", result: String(e), durationMs: Date.now() - t0 });
    } finally {
      setActiveStep(null);
    }
  }

  async function toggleActive() {
    const res = await fetch(`/api/admin/personas/${personaId}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "toggle-active" }),
    });
    const data = await res.json() as { is_active: boolean };
    setIsActive(data.is_active);
  }

  async function loadRecentRuns() {
    const res = await fetch(`/api/admin/personas/${personaId}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "recent-runs" }),
    });
    const data = await res.json() as { runs: PersonaRun[] };
    setRecentRuns(data.runs ?? []);
    setRunsLoaded(true);
  }

  async function loadContext() {
    setContextLoading(true);
    setContextLayers(null);
    const res = await fetch(`/api/admin/personas/${personaId}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "show-context", topic: contextTopic || undefined }),
    });
    const data = await res.json() as { layers: ContextLayer[] };
    setContextLayers(data.layers ?? []);
    setContextLoading(false);
  }

  const anyLoading = activeStep !== null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative h-14 w-14 overflow-hidden rounded-full border border-white/[0.1]">
            <Image src={avatar} alt={name} fill className="object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          </div>
          <div>
            <p className="text-base font-black text-white">{name}</p>
            <p className="text-xs text-zinc-500">{role} · {sources}</p>
            <p className="mt-1 text-[11px] text-zinc-600">Cron: {cronTime}</p>
          </div>
        </div>
        <button onClick={toggleActive} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
          isActive ? "border-emerald-400/30 text-emerald-400 hover:border-emerald-400/60"
                   : "border-white/[0.1] text-zinc-500 hover:border-white/20 hover:text-zinc-300"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-zinc-600"}`} />
          {isActive === null ? "Active?" : isActive ? "Active" : "Inactive"}
        </button>
      </div>

      {/* Pipeline steps */}
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-zinc-600">Pipeline Steps</p>
        <div className="flex flex-wrap gap-2">
          {STEPS.map(({ key, label, desc, color }) => (
            <button key={key} onClick={() => runStep(key)} disabled={anyLoading} title={desc}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition disabled:cursor-wait disabled:opacity-40 ${color}`}>
              {activeStep === key && <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {activeStep === key ? "Running…" : label}
            </button>
          ))}
        </div>
      </div>

      {/* Step results */}
      <div className="space-y-3">
        {STEPS.map(({ key, label }) => {
          const s = steps[key];
          if (s.status === "idle") return null;
          return (
            <div key={key} className={`rounded-lg border p-4 ${
              s.status === "loading" ? "border-white/[0.06] bg-zinc-900/20 animate-pulse"
              : s.status === "ok"    ? "border-emerald-500/20 bg-emerald-500/5"
              : s.status === "skipped" ? "border-amber-500/20 bg-amber-500/5"
              : "border-red-500/20 bg-red-500/5"
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-500">{label}</span>
                  <StatusBadge status={s.status} />
                </div>
                {s.durationMs && <span className="text-[11px] text-zinc-600">{(s.durationMs / 1000).toFixed(1)}s</span>}
              </div>
              {s.status !== "loading" && Boolean(s.result) && (
                <div className="mt-3">
                  <StepResult stepKey={key} personaId={personaId} result={s.result} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent Runs */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-950/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-zinc-300">Recent Runs</p>
          <button onClick={loadRecentRuns} className="text-xs text-zinc-500 hover:text-zinc-300">
            {runsLoaded ? "↻ Refresh" : "Load"}
          </button>
        </div>
        {runsLoaded && recentRuns.length === 0 && <p className="text-xs text-zinc-600">No runs yet.</p>}
        {recentRuns.length > 0 && (
          <div className="divide-y divide-white/[0.04]">
            {recentRuns.map((run) => (
              <div key={run.id} className="flex items-start justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${run.should_write ? "bg-emerald-400" : "bg-zinc-600"}`} />
                    <span className="text-xs font-semibold text-zinc-300">{run.should_write ? (run.topic ?? "Wrote") : "Silent"}</span>
                    <span className={`text-[11px] font-black ${run.score >= 80 ? "text-emerald-400" : run.score >= 60 ? "text-amber-400" : "text-zinc-600"}`}>{run.score}/100</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-600">{run.reasoning}</p>
                  {run.article_slug && (
                    <a href={`/crypto/${run.article_slug}`} target="_blank" className="mt-0.5 block text-[11px] text-cyan-500 hover:underline">
                      {run.article_slug}
                    </a>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-[11px] text-zinc-600">{run.run_date}</p>
                  {run.primary_signal && <p className="text-[10px] text-zinc-700">{run.primary_signal}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Memory & Context */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-950/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-bold text-zinc-300">Memory & Context</p>
            <p className="mt-0.5 text-[11px] text-zinc-600">What {name.split(' ')[0]} sees before generating</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="text" value={contextTopic} onChange={(e) => setContextTopic(e.target.value)}
              placeholder="topic for semantic search" className="w-48 rounded-lg border border-white/[0.08] bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-700 focus:border-cyan-400/40 focus:outline-none" />
            <button onClick={loadContext} disabled={contextLoading}
              className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-xs font-bold text-zinc-400 transition hover:border-white/20 hover:text-zinc-200 disabled:cursor-wait disabled:opacity-40">
              {contextLoading ? "Loading…" : contextLayers ? "↻ Refresh" : "Show Memory"}
            </button>
          </div>
        </div>
        {contextLayers && (
          <div className="space-y-2">
            {contextLayers.map((layer, i) => (
              <details key={i} open={!layer.empty}>
                <summary className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition hover:bg-white/[0.03] ${layer.empty ? "text-zinc-700" : "text-zinc-300"}`}>
                  <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${layer.empty ? "bg-zinc-700" : "bg-cyan-400"}`} />
                  {layer.label}
                  {layer.empty && <span className="ml-1 text-zinc-700">(empty)</span>}
                </summary>
                <pre className="mt-1 max-h-56 overflow-y-auto rounded-lg bg-zinc-950 px-4 py-3 text-[11px] leading-[1.7] text-zinc-400 whitespace-pre-wrap">{layer.content}</pre>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function PersonasTab() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-black text-white">AI Personas</h2>
        <p className="mt-1 text-sm text-zinc-500">Test and manage editorial persona pipelines.</p>
      </div>

      <PersonaCard
        personaId="elena-voss"
        name="Elena Voss"
        role="Macro Bear"
        avatar="/authors/elena-voss.png"
        sources="FRED / SEC EDGAR / CoinGecko"
        cronTime="08:00 UTC daily"
      />

      <PersonaCard
        personaId="marcus-webb"
        name="Marcus Webb"
        role="On-Chain Analyst"
        avatar="/authors/marcus-webb.png"
        sources="CoinGecko / CoinGlass / mempool.space / blockchain.info"
        cronTime="07:00 + 13:00 UTC"
      />

      <PersonaCard
        personaId="leo-cruz"
        name="Leo Cruz"
        role="Narrative Hunter"
        avatar="/authors/leo-cruz.png"
        sources="CoinGecko / Fear&Greed / Reddit / DexScreener"
        cronTime="10:00 UTC daily"
      />

      <ChiefEditorCard />
    </div>
  );
}

// ── Chief Editor Card ─────────────────────────────────────────────────────────

interface VictorRun {
  id: string; run_date: string; should_write: boolean;
  reasoning: string; topic: string | null; created_at: string;
  data_snapshot: Record<string, unknown>;
}

function ChiefEditorCard() {
  const [running, setRunning]     = useState(false);
  const [result, setResult]       = useState<Record<string, unknown> | null>(null);
  const [runs, setRuns]           = useState<VictorRun[]>([]);
  const [runsLoaded, setRunsLoaded] = useState(false);

  async function runFeedback() {
    setRunning(true); setResult(null);
    const res = await fetch('/api/admin/personas/victor-kane', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'run' }), signal: AbortSignal.timeout(65000),
    });
    setResult(await res.json() as Record<string, unknown>);
    setRunning(false);
  }

  async function loadRuns() {
    const res = await fetch('/api/admin/personas/victor-kane', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'recent-runs' }),
    });
    const data = await res.json() as { runs: VictorRun[] };
    setRuns(data.runs ?? []);
    setRunsLoaded(true);
  }

  const r = result as Record<string, unknown> | null;

  return (
    <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-2xl">
            ✍
          </div>
          <div>
            <p className="text-base font-black text-white">Victor Kane</p>
            <p className="text-xs text-zinc-500">Chief Editor · reads all analysts · 21:00 UTC</p>
            <p className="mt-1 text-[11px] text-zinc-600">Does not publish · writes feedback to analyst memory</p>
          </div>
        </div>
        <button onClick={runFeedback} disabled={running}
          className="flex items-center gap-2 rounded-lg border border-amber-400/30 px-4 py-2 text-sm font-bold text-amber-300 transition hover:border-amber-400/60 disabled:cursor-wait disabled:opacity-40">
          {running && <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
          {running ? 'Running…' : '▶ Run Feedback'}
        </button>
      </div>

      {/* Result */}
      {r && (
        <div className={`rounded-lg border p-4 ${Boolean(r.ran) ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/40'}`}>
          {Boolean(r.ran) ? (
            <div className="space-y-2">
              <p className="text-sm font-bold text-emerald-400">✓ Session complete — {String(r.date ?? '')}</p>
              <p className="text-xs text-zinc-400">{String(r.deskNote ?? '')}</p>
              {Boolean(r.scores) && (
                <div className="flex gap-4 text-[11px]">
                  {Object.entries(r.scores as Record<string, number | null>).map(([id, score]) => (
                    <span key={id} className="text-zinc-500">
                      {id.split('-')[0]}: <span className={`font-bold ${typeof score === 'number' && score >= 80 ? 'text-emerald-400' : typeof score === 'number' && score >= 65 ? 'text-amber-400' : 'text-zinc-400'}`}>{score ?? '—'}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">{String(r.reason ?? r.error ?? 'No result')}</p>
          )}
        </div>
      )}

      {/* Recent sessions */}
      <div className="border-t border-white/[0.04] pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-zinc-400">Recent Sessions</p>
          <button onClick={loadRuns} className="text-xs text-zinc-500 hover:text-zinc-300">{runsLoaded ? '↻ Refresh' : 'Load'}</button>
        </div>
        {runsLoaded && runs.length === 0 && <p className="text-xs text-zinc-600">No sessions yet.</p>}
        {runs.map((run) => {
          const scores = (run.data_snapshot?.scores ?? {}) as Record<string, number | null>;
          return (
            <div key={run.id} className="flex items-start justify-between gap-4 border-t border-white/[0.04] py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-300">{run.should_write ? '✓ Session' : '— Quiet desk'}</p>
                <p className="mt-0.5 truncate text-[11px] text-zinc-600">{run.reasoning}</p>
                {Object.keys(scores).length > 0 && (
                  <div className="flex gap-3 mt-1 text-[10px]">
                    {Object.entries(scores).map(([id, s]) => (
                      <span key={id} className="text-zinc-600">{id.split('-')[0]}: <span className="text-zinc-400">{s ?? '—'}</span></span>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[11px] text-zinc-600 flex-shrink-0">{run.run_date}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: StepState["status"] }) {
  const map = {
    idle:    { label: "idle",    cls: "bg-zinc-800 text-zinc-500" },
    loading: { label: "running", cls: "bg-zinc-800 text-zinc-400 animate-pulse" },
    ok:      { label: "ok",      cls: "bg-emerald-500/20 text-emerald-400" },
    error:   { label: "error",   cls: "bg-red-500/20 text-red-400" },
    skipped: { label: "skipped", cls: "bg-amber-500/20 text-amber-400" },
  };
  const { label, cls } = map[status];
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${cls}`}>{label}</span>;
}

function StepResult({ stepKey, personaId, result }: { stepKey: PipelineStep; personaId: string; result: unknown }) {
  const r = result as Record<string, unknown>;

  if (typeof result === "string") return <p className="font-mono text-xs text-red-400">{result}</p>;

  if (stepKey === "data-pull") {
    // Leo returns data + signals; Elena returns data
    if (personaId === "marcus-webb") {
      const anomalies = r.anomalies as Array<{ metric: string; label: string; value: number; zScore: number; direction: string; context: string; source: string }> | undefined;
      const d = r.data as Record<string, unknown> | undefined;
      return (
        <div className="space-y-3">
          {d && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
              {([
                ["BTC Price",    `$${Number(d.btcPrice).toLocaleString()}`, ""],
                ["Volume ratio", d.btcVolumeRatio, "x"],
                ["Exchange flow",d.btcExchangeNetflow, " BTC"],
                ["Miner outflow",d.minerOutflows, " BTC"],
                ["Mempool Tx",   d.mempoolTxCount, ""],
                ["Fear & Greed", d.fearGreedIndex, "/100"],
              ] as [string, unknown, string][]).map(([label, val, unit]) => (
                <div key={label} className="flex justify-between gap-2 py-0.5">
                  <span className="text-zinc-500">{label}</span>
                  <span className="font-mono font-semibold text-zinc-200">{typeof val === "number" ? val.toFixed(0) : String(val)}{unit}</span>
                </div>
              ))}
            </div>
          )}
          <div className="text-[11px] text-zinc-600">Baseline samples: {String(r.baseline_samples ?? 0)}/30</div>
          {anomalies && anomalies.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Anomalies (|z| ≥ 1.8)</p>
              {anomalies.map((a, i) => (
                <div key={i} className="flex items-center gap-2 py-1 text-xs border-t border-white/[0.04]">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${Math.abs(a.zScore) >= 2.5 ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}`}>{a.zScore > 0 ? "+" : ""}{a.zScore.toFixed(1)}σ</span>
                  <span className="text-zinc-400 flex-1">{a.label} — {a.context}</span>
                  <span className="text-zinc-600 text-[10px]">{a.source}</span>
                </div>
              ))}
            </div>
          )}
          {anomalies?.length === 0 && <p className="text-xs text-zinc-600">No anomalies detected — all metrics within 1.8σ of baseline</p>}
        </div>
      );
    }

    if (personaId === "leo-cruz") {
      const signals = r.signals as Array<{ type: string; strength: number; description: string }> | undefined;
      const d = r.data as Record<string, unknown> | undefined;
      return (
        <div className="space-y-3">
          {d && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
              {([
                ["Fear & Greed", d.fearGreedCurrent, ""],
                ["F&G 7d delta", d.fearGreedDelta7d, "pts"],
                ["Trending coins", (d.trendingCoins as unknown[])?.length ?? 0, ""],
                ["Hot posts", (d.hotPosts as unknown[])?.length ?? 0, ""],
                ["DEX boosts", (d.dexBoosts as unknown[])?.length ?? 0, ""],
                ["Stories", (d.trendingStories as unknown[])?.length ?? 0, ""],
              ] as [string, unknown, string][]).map(([label, val, unit]) => (
                <div key={label} className="flex justify-between gap-2 py-0.5">
                  <span className="text-zinc-500">{label}</span>
                  <span className="font-mono font-semibold text-zinc-200">{String(val)}{unit}</span>
                </div>
              ))}
            </div>
          )}
          {signals && signals.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Signals detected</p>
              {signals.map((s, i) => (
                <div key={i} className="flex items-center gap-2 py-1 text-xs border-t border-white/[0.04]">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${s.strength >= 70 ? "bg-emerald-500/15 text-emerald-400" : s.strength >= 50 ? "bg-amber-500/15 text-amber-400" : "bg-zinc-800 text-zinc-500"}`}>{s.strength}</span>
                  <span className="text-zinc-600 text-[10px] uppercase">{s.type}</span>
                  <span className="text-zinc-400 flex-1">{s.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    // Elena data pull
    const d = r.data as Record<string, unknown> | undefined;
    if (!d) return <JsonPreview data={result} />;
    return (
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
        {([
          ["Fed Funds Rate", d.fedFundsRate, "%"], ["CPI YoY", d.cpiYoY, "%"],
          ["Core PCE", d.corePce, "%"],            ["10Y Yield", d.tenYearYield, "%"],
          ["2Y Yield", d.twoYearYield, "%"],       ["Yield Curve", d.yieldCurveSpread, "%"],
          ["USD Index", d.dxyIndex, ""],           ["BTC 24h", d.btcChange24h, "%"],
        ] as [string, unknown, string][]).map(([label, val, unit]) => (
          <div key={label} className="flex justify-between gap-2 py-0.5">
            <span className="text-zinc-500">{label}</span>
            <span className="font-mono font-semibold text-zinc-200">{typeof val === "number" ? val.toFixed(2) : "—"}{unit}</span>
          </div>
        ))}
        {Array.isArray(d.secFilings) && (
          <div className="col-span-full mt-1 pt-1 border-t border-white/[0.04]">
            <span className="text-zinc-600">SEC filings: </span>
            <span className="text-zinc-400">{(d.secFilings as unknown[]).length} found</span>
          </div>
        )}
      </div>
    );
  }

  if (stepKey === "should-write") {
    const ev = r.result as Record<string, unknown> | undefined;
    if (!ev) return <JsonPreview data={result} />;
    const score = ev.score as number;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className={`text-2xl font-black ${score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-zinc-500"}`}>{score}/100</div>
          <div>
            <p className={`text-xs font-bold ${Boolean(ev.should_write) ? "text-emerald-400" : "text-zinc-500"}`}>{Boolean(ev.should_write) ? "✓ Will write" : "✗ Silent today"}</p>
            {Boolean(ev.calendar_event) && <p className="text-[11px] text-sky-400">{String(ev.calendar_event)}</p>}
            {Boolean(ev.narrative_type) && <p className="text-[11px] text-violet-400">{String(ev.narrative_type)}</p>}
          </div>
        </div>
        <p className="text-xs text-zinc-400">{String(ev.reasoning ?? "")}</p>
        {Boolean(ev.topic) && <p className="text-xs text-zinc-500">Topic: <span className="text-zinc-300">{String(ev.topic)}</span></p>}
      </div>
    );
  }

  if (stepKey === "generate") {
    if (r.skipped) return (
      <div>
        <p className="text-xs text-amber-400">Score {String(r.score)}/100 — below threshold.</p>
        <p className="mt-1 text-xs text-zinc-500">{String(r.reasoning)}</p>
      </div>
    );
    const article = r.article as Record<string, unknown> | undefined;
    if (!article) return <JsonPreview data={result} />;
    return (
      <div className="space-y-2">
        <p className="text-sm font-bold text-white">{String(article.title ?? "")}</p>
        <p className="text-xs text-zinc-400">{String(article.excerpt ?? "")}</p>
        <div className="flex flex-wrap gap-3 text-[11px] text-zinc-600">
          <span>Category: <span className="text-zinc-400">{String(article.category ?? "")}</span></span>
          <span>Tags: <span className="text-zinc-400">{(article.tags as string[] | undefined)?.join(", ")}</span></span>
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-zinc-600 hover:text-zinc-400">Preview body →</summary>
          <pre className="mt-2 max-h-64 overflow-y-auto rounded bg-zinc-950 p-3 text-[11px] leading-5 text-zinc-400 whitespace-pre-wrap">{String(article.body ?? "")}</pre>
        </details>
      </div>
    );
  }

  if (stepKey === "self-work") {
    if (r.skipped) return <p className="text-xs text-amber-400">No self-work needed. {String(r.reason ?? "")}</p>;
    const task = r.task as Record<string, unknown> | undefined;
    const updates = r.trackerUpdates as Record<string, string[]> | undefined;
    return (
      <div className="space-y-1">
        <p className={`text-sm font-bold ${Boolean(r.wrote) ? "text-emerald-400" : "text-zinc-400"}`}>
          {Boolean(r.wrote) ? `✓ ${String(r.type ?? "")} — ${String(r.articleSlug ?? "")}` : `✓ ${String(r.type ?? "")} (no article)`}
        </p>
        {task && <p className="text-xs text-zinc-500">Task: <span className="text-zinc-300">{String(task.type ?? "")}</span></p>}
        {updates && (
          <p className="text-[11px] text-zinc-600">
            Tracker: +{(updates.added ?? []).length} new · {(updates.advanced ?? []).length} advanced · {(updates.faded ?? []).length} fading
          </p>
        )}
        {Boolean(r.articleSlug) && (
          <a href={`/crypto/${String(r.articleSlug)}`} target="_blank" className="block text-xs text-cyan-400 hover:underline">View article →</a>
        )}
      </div>
    );
  }

  if (stepKey === "run") {
    const sw = r.selfWork as Record<string, unknown> | undefined;
    return (
      <div className="space-y-1">
        <p className={`text-sm font-bold ${Boolean(r.wrote) ? "text-emerald-400" : "text-zinc-500"}`}>
          {Boolean(r.wrote) ? `✓ Published: ${String(r.articleSlug ?? "")}` : "✗ Silent (not published)"}
        </p>
        <p className="text-xs text-zinc-500">{String(r.reasoning ?? "")}</p>
        {sw && <p className="text-[11px] text-zinc-600">Self-work: {String(sw.type ?? "")}</p>}
        {Boolean(r.articleSlug) && (
          <a href={`/${String(r.articleCategory ?? "crypto")}/${String(r.articleSlug)}`} target="_blank" className="block text-xs text-cyan-400 hover:underline">View article →</a>
        )}
      </div>
    );
  }

  return <JsonPreview data={result} />;
}

function JsonPreview({ data }: { data: unknown }) {
  return (
    <pre className="max-h-48 overflow-auto rounded bg-zinc-950 p-3 text-[11px] leading-5 text-zinc-400">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
