"use client";

import { useState, useCallback } from "react";
import Image from "next/image";

type PipelineStep = "data-pull" | "should-write" | "generate" | "run";

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

const STEPS: { key: PipelineStep; label: string; desc: string; color: string }[] = [
  {
    key: "data-pull",
    label: "Pull Data",
    desc: "FRED + SEC + CoinGecko",
    color: "border-sky-400/30 text-sky-300 hover:border-sky-400/60",
  },
  {
    key: "should-write",
    label: "Evaluate",
    desc: "Editorial judgment (score 0-100)",
    color: "border-violet-400/30 text-violet-300 hover:border-violet-400/60",
  },
  {
    key: "generate",
    label: "Dry Generate",
    desc: "Generate article, no publish",
    color: "border-amber-400/30 text-amber-300 hover:border-amber-400/60",
  },
  {
    key: "run",
    label: "▶ Full Run",
    desc: "Generate + publish to site",
    color: "bg-emerald-500 text-zinc-950 border-transparent hover:bg-emerald-400",
  },
];

export default function PersonasTab() {
  const [steps, setSteps] = useState<Record<PipelineStep, StepState>>({
    "data-pull": { status: "idle", result: null },
    "should-write": { status: "idle", result: null },
    generate: { status: "idle", result: null },
    run: { status: "idle", result: null },
  });
  const [activeStep, setActiveStep] = useState<PipelineStep | null>(null);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [recentRuns, setRecentRuns] = useState<PersonaRun[]>([]);
  const [runsLoaded, setRunsLoaded] = useState(false);

  const setStep = useCallback((key: PipelineStep, patch: Partial<StepState>) => {
    setSteps(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }, []);

  async function runStep(step: PipelineStep) {
    setActiveStep(step);
    setStep(step, { status: "loading", result: null });
    const t0 = Date.now();
    try {
      const res = await fetch("/api/admin/personas/elena-voss", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: step }),
        signal: AbortSignal.timeout(65000),
      });
      const data = await res.json() as Record<string, unknown>;
      const durationMs = Date.now() - t0;
      if (!res.ok || data.error) {
        setStep(step, { status: "error", result: data.error ?? data, durationMs });
      } else if (data.skipped) {
        setStep(step, { status: "skipped", result: data, durationMs });
      } else {
        setStep(step, { status: "ok", result: data, durationMs });
      }
    } catch (e) {
      setStep(step, { status: "error", result: String(e), durationMs: Date.now() - t0 });
    } finally {
      setActiveStep(null);
    }
  }

  async function toggleActive() {
    const res = await fetch("/api/admin/personas/elena-voss", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "toggle-active" }),
    });
    const data = await res.json() as { is_active: boolean };
    setIsActive(data.is_active);
  }

  async function loadRecentRuns() {
    const res = await fetch("/api/admin/personas/elena-voss", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "recent-runs" }),
    });
    const data = await res.json() as { runs: PersonaRun[] };
    setRecentRuns(data.runs ?? []);
    setRunsLoaded(true);
  }

  const anyLoading = activeStep !== null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-black text-white">AI Personas</h2>
        <p className="mt-1 text-sm text-zinc-500">Test and manage editorial persona pipelines.</p>
      </div>

      {/* Elena Voss Card */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-full border border-white/[0.1]">
              <Image
                src="/authors/elena-voss.png"
                alt="Elena Voss"
                fill
                className="object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div>
              <p className="text-base font-black text-white">Elena Voss</p>
              <p className="text-xs text-zinc-500">Macro Bear · FRED / SEC EDGAR / CoinGecko</p>
              <p className="mt-1 text-[11px] text-zinc-600">Cron: 08:00 UTC daily</p>
            </div>
          </div>
          <button
            onClick={toggleActive}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              isActive
                ? "border-emerald-400/30 text-emerald-400 hover:border-emerald-400/60"
                : "border-white/[0.1] text-zinc-500 hover:border-white/20 hover:text-zinc-300"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-zinc-600"}`} />
            {isActive === null ? "Active?" : isActive ? "Active" : "Inactive"}
          </button>
        </div>

        {/* Pipeline buttons */}
        <div className="mt-6">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-zinc-600">Pipeline Steps</p>
          <div className="flex flex-wrap gap-2">
            {STEPS.map(({ key, label, desc, color }) => (
              <button
                key={key}
                onClick={() => runStep(key)}
                disabled={anyLoading}
                title={desc}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition disabled:cursor-wait disabled:opacity-40 ${color}`}
              >
                {activeStep === key && (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                {activeStep === key ? "Running…" : label}
              </button>
            ))}
          </div>
        </div>

        {/* Step results */}
        <div className="mt-6 space-y-3">
          {STEPS.map(({ key, label }) => {
            const s = steps[key];
            if (s.status === "idle") return null;
            return (
              <div key={key} className={`rounded-lg border p-4 ${
                s.status === "loading" ? "border-white/[0.06] bg-zinc-900/20" :
                s.status === "ok"      ? "border-emerald-500/20 bg-emerald-500/5" :
                s.status === "skipped" ? "border-amber-500/20 bg-amber-500/5" :
                                         "border-red-500/20 bg-red-500/5"
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest text-zinc-500">{label}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  {s.durationMs && (
                    <span className="text-[11px] text-zinc-600">{(s.durationMs / 1000).toFixed(1)}s</span>
                  )}
                </div>

                {s.status !== "loading" && Boolean(s.result) && (
                  <div className="mt-3">
                    <StepResult stepKey={key} result={s.result} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Runs */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-white">Recent Runs</p>
          <button
            onClick={loadRecentRuns}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            {runsLoaded ? "↻ Refresh" : "Load"}
          </button>
        </div>

        {runsLoaded && recentRuns.length === 0 && (
          <p className="mt-4 text-sm text-zinc-600">No runs yet.</p>
        )}

        {recentRuns.length > 0 && (
          <div className="mt-4 divide-y divide-white/[0.04]">
            {recentRuns.map(run => (
              <div key={run.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${run.should_write ? "bg-emerald-400" : "bg-zinc-600"}`} />
                    <span className="text-xs font-semibold text-zinc-300">
                      {run.should_write ? (run.topic ?? "Wrote") : "Silent"}
                    </span>
                    <span className={`text-[11px] font-black ${
                      run.score >= 80 ? "text-emerald-400" :
                      run.score >= 60 ? "text-amber-400" :
                      "text-zinc-600"
                    }`}>
                      {run.score}/100
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-600">{run.reasoning}</p>
                  {run.article_slug && (
                    <a
                      href={`/economy/${run.article_slug}`}
                      target="_blank"
                      className="mt-0.5 block text-[11px] text-cyan-500 hover:underline"
                    >
                      {run.article_slug}
                    </a>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-[11px] text-zinc-600">{run.run_date}</p>
                  {run.primary_signal && (
                    <p className="text-[10px] text-zinc-700">{run.primary_signal}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: StepState["status"] }) {
  const map = {
    idle:    { label: "idle",    cls: "bg-zinc-800 text-zinc-500" },
    loading: { label: "running", cls: "bg-zinc-800 text-zinc-400 animate-pulse" },
    ok:      { label: "ok",      cls: "bg-emerald-500/20 text-emerald-400" },
    error:   { label: "error",   cls: "bg-red-500/20 text-red-400" },
    skipped: { label: "skipped", cls: "bg-amber-500/20 text-amber-400" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

function StepResult({ stepKey, result }: { stepKey: PipelineStep; result: unknown }) {
  const r = result as Record<string, unknown>;

  if (typeof result === "string") {
    return <p className="font-mono text-xs text-red-400">{result}</p>;
  }

  if (stepKey === "data-pull") {
    const d = r.data as Record<string, unknown> | undefined;
    if (!d) return <JsonPreview data={result} />;
    return (
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
        {([
          ["Fed Funds Rate", d.fedFundsRate, "%"],
          ["CPI YoY", d.cpiYoY, "%"],
          ["Core PCE", d.corePce, "%"],
          ["10Y Yield", d.tenYearYield, "%"],
          ["2Y Yield", d.twoYearYield, "%"],
          ["Yield Curve", d.yieldCurveSpread, "%"],
          ["USD Index", d.dxyIndex, ""],
          ["BTC 24h", d.btcChange24h, "%"],
        ] as [string, unknown, string][]).map(([label, val, unit]) => (
          <div key={label} className="flex justify-between gap-2 py-0.5">
            <span className="text-zinc-500">{label}</span>
            <span className="font-mono font-semibold text-zinc-200">
              {typeof val === "number" ? val.toFixed(2) : "—"}{unit}
            </span>
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
          <div className={`text-2xl font-black ${score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-zinc-500"}`}>
            {score}/100
          </div>
          <div>
            <p className={`text-xs font-bold ${Boolean(ev.should_write) ? "text-emerald-400" : "text-zinc-500"}`}>
              {Boolean(ev.should_write) ? "✓ Will write" : "✗ Silent today"}
            </p>
            {Boolean(ev.calendar_event) && (
              <p className="text-[11px] text-sky-400">{String(ev.calendar_event)}</p>
            )}
          </div>
        </div>
        <p className="text-xs text-zinc-400">{String(ev.reasoning ?? "")}</p>
        {Boolean(ev.topic) && <p className="text-xs text-zinc-500">Topic: <span className="text-zinc-300">{String(ev.topic)}</span></p>}
        {Boolean(ev.primary_signal) && <p className="text-[11px] text-zinc-600">Signal: {String(ev.primary_signal)}</p>}
      </div>
    );
  }

  if (stepKey === "generate") {
    if (r.skipped) {
      return (
        <div>
          <p className="text-xs text-amber-400">Score {String(r.score)}/100 — below threshold, not generating.</p>
          <p className="mt-1 text-xs text-zinc-500">{String(r.reasoning)}</p>
        </div>
      );
    }
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
          <pre className="mt-2 max-h-64 overflow-y-auto rounded bg-zinc-950 p-3 text-[11px] leading-5 text-zinc-400 whitespace-pre-wrap">
            {String(article.body ?? "")}
          </pre>
        </details>
        <details className="mt-1">
          <summary className="cursor-pointer text-[11px] text-zinc-600 hover:text-zinc-400">Telegram text →</summary>
          <pre className="mt-2 rounded bg-zinc-950 p-3 text-[11px] leading-5 text-zinc-400 whitespace-pre-wrap">
            {String(article.telegramText ?? "")}
          </pre>
        </details>
      </div>
    );
  }

  if (stepKey === "run") {
    return (
      <div className="space-y-1">
        <p className={`text-sm font-bold ${Boolean(r.wrote) ? "text-emerald-400" : "text-zinc-500"}`}>
          {Boolean(r.wrote) ? `✓ Published: ${String(r.articleSlug ?? "")}` : "✗ Silent (not published)"}
        </p>
        <p className="text-xs text-zinc-500">{String(r.reasoning ?? "")}</p>
        {Boolean(r.articleSlug) && (
          <a
            href={`/economy/${String(r.articleSlug)}`}
            target="_blank"
            className="block text-xs text-cyan-400 hover:underline"
          >
            View article →
          </a>
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
