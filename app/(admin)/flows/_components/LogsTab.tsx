"use client";

import { useState } from "react";
import type { RunLog, PipelineStep } from "@/lib/supabase";
import RunButton from "./RunButton";
import AutoRefresh from "./AutoRefresh";

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmt(ms: number | null) {
  if (!ms) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function badge(status: RunLog["status"]) {
  const map = {
    success: "bg-emerald-500/15 text-emerald-400",
    error:   "bg-red-500/15 text-red-400",
    running: "bg-amber-500/15 text-amber-400 animate-pulse",
    partial: "bg-orange-500/15 text-orange-400",
  };
  return map[status] ?? "bg-zinc-700 text-zinc-400";
}

function scoreBadge(score?: number) {
  if (!score) return null;
  const cls = score >= 70 ? "bg-emerald-500/15 text-emerald-400"
    : score >= 50 ? "bg-cyan-500/15 text-cyan-400"
    : "bg-zinc-700/50 text-zinc-500";
  return <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${cls}`}>{score}</span>;
}

function stepStatusDot(status: PipelineStep["status"]) {
  const map = {
    ok:       "bg-emerald-400",
    error:    "bg-red-400",
    fallback: "bg-amber-400",
    skip:     "bg-zinc-600",
  };
  return map[status] ?? "bg-zinc-600";
}

function subStepIcon(status: "ok" | "error" | "skip") {
  if (status === "ok")    return <span className="text-emerald-400">✓</span>;
  if (status === "error") return <span className="text-red-400">✗</span>;
  return <span className="text-zinc-600">–</span>;
}

const STEP_LABEL: Record<string, string> = {
  rss_fetch:       "RSS Fetch",
  keyword_filter:  "Keyword Filter",
  ai_score:        "AI Scoring",
  dedup:           "Dedup",
  queue_insert:    "Queue Insert",
  scrape:          "Scrape",
  claude:          "Claude",
  sanity:          "Sanity",
  pexels:          "Pexels",
  telegraph:       "Telegraph",
  telegram:        "Telegram",
};

function CollectStepDetail({ step }: { step: PipelineStep }) {
  return (
    <div className="mt-2 space-y-2">
      {/* per-source breakdown */}
      {step.perSource && (
        <div className="rounded-lg bg-zinc-900/60 px-3 py-2">
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-600">Per Source</p>
          <div className="space-y-0.5">
            {step.perSource.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-[11px]">
                <span className={`h-1.5 w-1.5 rounded-full ${s.error ? "bg-red-400" : "bg-zinc-600"}`} />
                <span className="w-28 truncate text-zinc-400">{s.name}</span>
                <span className="rounded bg-white/[0.04] px-1.5 text-[9px] text-zinc-500">{s.category}</span>
                <span className={`ml-auto tabular-nums font-semibold ${s.count > 0 ? "text-zinc-300" : "text-zinc-700"}`}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* score distribution */}
      {step.scoreDistribution && (
        <div className="rounded-lg bg-zinc-900/60 px-3 py-2">
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-600">Score Distribution</p>
          <div className="flex gap-3 text-[11px]">
            <span className="text-zinc-600">&lt;45: <span className="font-bold text-red-400/70">{step.scoreDistribution.below45}</span></span>
            <span className="text-zinc-600">45–60: <span className="font-bold text-zinc-400">{step.scoreDistribution.s45_60}</span></span>
            <span className="text-zinc-600">60–80: <span className="font-bold text-cyan-400">{step.scoreDistribution.s60_80}</span></span>
            <span className="text-zinc-600">&gt;80: <span className="font-bold text-emerald-400">{step.scoreDistribution.above80}</span></span>
          </div>
        </div>
      )}

      {/* scored items list */}
      {step.scoredItems && step.scoredItems.length > 0 && (
        <div className="rounded-lg bg-zinc-900/60 px-3 py-2">
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-600">Top Scored</p>
          <div className="space-y-0.5">
            {step.scoredItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className={`min-w-[28px] rounded px-1 py-0.5 text-center text-[9px] font-bold tabular-nums ${
                  item.score >= 80 ? "bg-emerald-500/15 text-emerald-400"
                  : item.score >= 60 ? "bg-cyan-500/15 text-cyan-400"
                  : "bg-zinc-800 text-zinc-500"}`}>{item.score}</span>
                <span className="truncate text-zinc-400">{item.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* dedup breakdown */}
      {step.dedupBreakdown && (
        <div className="rounded-lg bg-zinc-900/60 px-3 py-2">
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-600">Filtered Out</p>
          <div className="flex gap-4 text-[11px]">
            <span className="text-zinc-600">URL dup: <span className="font-bold text-zinc-400">{step.dedupBreakdown.urlDuped}</span></span>
            <span className="text-zinc-600">Low score: <span className="font-bold text-zinc-400">{step.dedupBreakdown.belowScore}</span></span>
            <span className="text-zinc-600">Semantic dup: <span className="font-bold text-zinc-400">{step.dedupBreakdown.semanticDuped}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

function ArticleStepDetail({ step }: { step: PipelineStep }) {
  if (!step.articleSteps?.length) return null;
  return (
    <div className="mt-2 rounded-lg bg-zinc-900/60 px-3 py-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {step.articleSteps.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px]">
            {subStepIcon(s.status)}
            <span className={s.status === "error" ? "text-red-400" : "text-zinc-400"}>
              {STEP_LABEL[s.name] ?? s.name}
            </span>
            <span className="tabular-nums text-zinc-600">{fmt(s.durationMs)}</span>
            {s.note && <span className="max-w-[200px] truncate text-zinc-600" title={s.note}>· {s.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepsTimeline({ steps, runType }: { steps: PipelineStep[]; runType: string }) {
  const [openStep, setOpenStep] = useState<number | null>(null);

  return (
    <div className="mt-3 space-y-1.5">
      {steps.map((step, i) => {
        const isArticle = step.name.startsWith("article:");
        const label = isArticle ? step.name.slice(8) : (STEP_LABEL[step.name] ?? step.name);
        const isOpen = openStep === i;
        const hasDetail = !!(step.perSource || step.scoreDistribution || step.scoredItems || step.dedupBreakdown || step.articleSteps?.length);

        return (
          <div key={i} className="rounded-lg border border-white/[0.04] bg-zinc-900/30">
            <button
              onClick={() => hasDetail && setOpenStep(isOpen ? null : i)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left ${hasDetail ? "cursor-pointer hover:bg-white/[0.02]" : "cursor-default"}`}
            >
              {/* connector line */}
              <div className="flex flex-col items-center gap-0.5 self-stretch">
                <span className={`mt-1.5 h-2 w-2 rounded-full ${stepStatusDot(step.status)}`} />
                {i < steps.length - 1 && <span className="w-px flex-1 bg-white/[0.04]" />}
              </div>

              <div className="flex flex-1 items-center gap-3 overflow-hidden">
                <span className="min-w-[110px] text-xs font-semibold text-zinc-200">{label}</span>

                {/* in → out */}
                {!isArticle && (
                  <span className="flex items-center gap-1 text-[11px] tabular-nums">
                    <span className="text-zinc-600">{step.in}</span>
                    <span className="text-zinc-700">→</span>
                    <span className={step.out > 0 ? "text-zinc-300" : "text-zinc-600"}>{step.out}</span>
                  </span>
                )}

                {step.note && (
                  <span className="truncate text-[10px] text-zinc-600" title={step.note}>{step.note}</span>
                )}

                <span className="ml-auto shrink-0 tabular-nums text-[10px] text-zinc-700">{fmt(step.durationMs)}</span>

                {step.status !== "ok" && (
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                    step.status === "error" ? "bg-red-500/15 text-red-400"
                    : step.status === "fallback" ? "bg-amber-500/15 text-amber-400"
                    : "bg-zinc-700 text-zinc-500"}`}>{step.status}</span>
                )}

                {hasDetail && (
                  <span className="shrink-0 text-[10px] text-zinc-700">{isOpen ? "▲" : "▼"}</span>
                )}
              </div>
            </button>

            {isOpen && hasDetail && (
              <div className="border-t border-white/[0.04] px-3 pb-3">
                {isArticle ? <ArticleStepDetail step={step} /> : <CollectStepDetail step={step} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type Props = {
  logs: RunLog[];
  queuePending: number;
  queueTotal: number;
  stats: { lastRun: RunLog | null; todayPublished: number; activeSources: number };
  totalProcessed: number;
};

export default function LogsTab({ logs, queuePending, queueTotal, stats, totalProcessed }: Props) {
  const { lastRun, todayPublished, activeSources } = stats;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      {/* Top bar */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Content Flows</h1>
          <p className="mt-1 text-sm text-zinc-500">RSS → Claude → Sanity → Telegraph → Telegram</p>
          <div className="mt-2"><AutoRefresh intervalMs={20000} /></div>
        </div>
        <RunButton />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Last run",       value: lastRun ? timeAgo(lastRun.started_at) : "Never", sub: lastRun?.status ?? "—", color: lastRun?.status === "success" ? "text-emerald-400" : "text-zinc-400" },
          { label: "Published today",value: String(todayPublished), sub: "articles", color: "text-white" },
          { label: "Queue pending",  value: String(queuePending), sub: `of ${queueTotal} total`, color: queuePending > 10 ? "text-amber-400" : "text-white" },
          { label: "Active sources", value: String(activeSources), sub: "RSS feeds", color: "text-white" },
          { label: "Total published",value: String(totalProcessed), sub: "all time", color: "text-white" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{s.label}</p>
            <p className={`mt-1.5 text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-zinc-600">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Run history */}
      <section>
        <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
          Run History
        </h2>
        <div className="space-y-1">
          {logs.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] py-10 text-center text-zinc-600">No runs yet</div>
          ) : logs.map((log) => {
            const r = log as unknown as Record<string, number>;
            const isExpanded = expandedId === log.id;
            const hasSteps = log.steps && log.steps.length > 0;
            const runType = log.run_type ?? "generate";

            return (
              <div key={log.id} className="overflow-hidden rounded-xl border border-white/[0.06]">
                {/* Row */}
                <button
                  onClick={() => hasSteps && setExpandedId(isExpanded ? null : log.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02] ${hasSteps ? "cursor-pointer" : "cursor-default"}`}
                >
                  {/* type pill */}
                  <span className={`shrink-0 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                    runType === "collect" ? "bg-blue-500/15 text-blue-400" : "bg-purple-500/15 text-purple-400"
                  }`}>{runType}</span>

                  <span className="w-20 shrink-0 text-xs tabular-nums text-zinc-400">{timeAgo(log.started_at)}</span>

                  <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${badge(log.status)}`}>{log.status}</span>

                  {/* collect stats */}
                  {runType === "collect" ? (
                    <span className="flex items-center gap-2 text-[11px] text-zinc-500">
                      <span>{log.articles_found} raw</span>
                      <span className="text-zinc-700">→</span>
                      <span className="text-emerald-400 font-semibold">{log.articles_published} queued</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-[11px] text-zinc-500">
                      <span>{r.articles_after_keywords || log.articles_found} checked</span>
                      <span className="text-zinc-700">→</span>
                      <span className="text-emerald-400 font-semibold">{log.articles_published} published</span>
                    </span>
                  )}

                  <span className="ml-auto shrink-0 tabular-nums text-[11px] text-zinc-600">{fmt(log.duration_ms)}</span>
                  {hasSteps && (
                    <span className="shrink-0 text-[11px] text-zinc-700">{isExpanded ? "▲" : "▼"}</span>
                  )}
                </button>

                {/* Steps timeline */}
                {isExpanded && hasSteps && (
                  <div className="border-t border-white/[0.04] bg-zinc-950/50 px-4 pb-4">
                    <StepsTimeline steps={log.steps!} runType={runType} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Last generate run — article detail */}
      {(() => {
        const lastGenerate = logs.find((l) => (l.run_type ?? "generate") === "generate");
        if (!lastGenerate?.details?.length) return null;
        return (
          <section>
            <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
              <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
              Last Generate — {lastGenerate.details.length} processed
            </h2>
            <div className="space-y-3">
              {lastGenerate.details.map((d, i) => (
                <div key={i} className={`rounded-xl border p-4 ${d.status === "published" ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/15 bg-red-500/5"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${d.status === "published" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                          {d.status}
                        </span>
                        {d.category && <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-zinc-400">{d.category}</span>}
                        {scoreBadge((d as { score?: number }).score)}
                        {(d as { imageAttached?: boolean }).imageAttached && <span className="text-[10px] text-cyan-400">📷</span>}
                      </div>
                      <p className="text-sm font-semibold text-zinc-100">{d.title ?? "—"}</p>
                      {(d as { excerpt?: string }).excerpt && (
                        <p className="mt-1 text-[11px] leading-5 text-zinc-500 line-clamp-2">{(d as { excerpt?: string }).excerpt}</p>
                      )}
                      {d.error && <p className="mt-1 text-[11px] text-red-400">{d.error}</p>}
                    </div>
                    {d.slug && d.category && (
                      <a href={`/${d.category}/${d.slug}`} target="_blank" rel="noreferrer"
                        className="shrink-0 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] text-zinc-500 hover:text-cyan-400">
                        View →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })()}
    </div>
  );
}
