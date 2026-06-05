"use client";

import { useEffect, useState } from "react";
import TelegraphStats from "./TelegraphStats";

const CATEGORY_EMOJI: Record<string, string> = {
  crypto: "₿", markets: "📈", economy: "🏦",
  fintech: "⚡", policy: "⚖️", companies: "🏢",
};

interface AnalyticsData {
  generate: {
    total: number; success: number; partial: number; error: number;
    published: number; avgPerRun: number; avgDuration: number; window: string;
  };
  collect: {
    total: number; success: number; avgFound: number; avgQueued: number; window: string;
  };
  categories: { name: string; published: number; error: number; skipped: number; total: number }[];
  personas: {
    "elena-voss": {
      total: number; wrote: number; silent: number; avgScore: number;
      publishRate: number; window: string;
      recentArticles: { slug: string | null; topic: string | null; created_at: string }[];
    };
  };
  sources: {
    total: number; enabled: number;
    top: { id: string; name: string; enabled: boolean; articles_published: number }[];
  };
  allTimePubs: number;
}

export default function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((d: AnalyticsData) => setData(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-white/[0.04]" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-white/[0.03]" />)}
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-400">
      Failed to load analytics: {error ?? "Unknown error"}
    </div>
  );

  const { generate: gen, collect: col, categories, personas, sources, allTimePubs } = data;
  const elena = personas["elena-voss"];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-black text-white">Analytics</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Generate: last {gen.window} · Collect: last {col.window} · Personas: last {elena.window}
        </p>
      </div>

      {/* ── Generate pipeline ── */}
      <section>
        <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
          Generate Pipeline <span className="text-zinc-700 font-normal normal-case">{gen.total} runs</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            { label: "Success rate",    value: gen.total > 0 ? `${Math.round((gen.success / gen.total) * 100)}%` : "—", sub: `${gen.success} success · ${gen.partial} partial · ${gen.error} errors`, color: gen.success / gen.total >= 0.8 ? "text-emerald-400" : "text-amber-400" },
            { label: "Articles published", value: String(gen.published), sub: `${gen.avgPerRun} avg per run`, color: "text-white" },
            { label: "Avg duration",    value: `${gen.avgDuration}s`, sub: "per generate run", color: "text-white" },
            { label: "All-time total",  value: allTimePubs.toLocaleString(), sub: "processed URLs", color: "text-white" },
          ] as const).map((s) => (
            <div key={s.label} className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{s.label}</p>
              <p className={`mt-1.5 text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-zinc-600">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Collect pipeline ── */}
      <section>
        <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
          Collect Pipeline <span className="text-zinc-700 font-normal normal-case">{col.total} runs (7d)</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            { label: "Success rate",  value: col.total > 0 ? `${Math.round((col.success / col.total) * 100)}%` : "—", sub: `${col.success} of ${col.total} runs`, color: col.success / col.total >= 0.9 ? "text-emerald-400" : "text-amber-400" },
            { label: "Avg found",     value: String(col.avgFound),   sub: "items per run", color: "text-white" },
            { label: "Avg queued",    value: String(col.avgQueued),  sub: "items per run", color: "text-white" },
            { label: "Queue rate",    value: col.avgFound > 0 ? `${Math.round((col.avgQueued / col.avgFound) * 100)}%` : "—", sub: "found → queued", color: "text-zinc-300" },
          ] as const).map((s) => (
            <div key={s.label} className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{s.label}</p>
              <p className={`mt-1.5 text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-zinc-600">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Persona stats ── */}
      <section>
        <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
          AI Personas <span className="text-zinc-700 font-normal normal-case">last 30 days</span>
        </h2>
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5">
          <div className="flex items-center gap-4 mb-4">
            <div>
              <p className="text-sm font-black text-white">Elena Voss</p>
              <p className="text-xs text-zinc-500">Macro Bear</p>
            </div>
            <div className="ml-auto flex gap-6 text-right">
              <div>
                <p className={`text-2xl font-black tabular-nums ${elena.publishRate >= 40 ? "text-emerald-400" : "text-amber-400"}`}>{elena.publishRate}%</p>
                <p className="text-[10px] text-zinc-600">publish rate</p>
              </div>
              <div>
                <p className="text-2xl font-black tabular-nums text-white">{elena.wrote}</p>
                <p className="text-[10px] text-zinc-600">articles</p>
              </div>
              <div>
                <p className="text-2xl font-black tabular-nums text-zinc-400">{elena.silent}</p>
                <p className="text-[10px] text-zinc-600">silent days</p>
              </div>
              <div>
                <p className="text-2xl font-black tabular-nums text-cyan-400">{elena.avgScore}</p>
                <p className="text-[10px] text-zinc-600">avg score</p>
              </div>
            </div>
          </div>
          {elena.recentArticles.length > 0 && (
            <div className="border-t border-white/[0.04] pt-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Recent articles</p>
              <div className="space-y-1.5">
                {elena.recentArticles.slice(0, 5).map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-700">·</span>
                    {a.slug
                      ? <a href={`/economy/${a.slug}`} target="_blank" className="text-cyan-400 hover:underline truncate">{a.slug}</a>
                      : <span className="text-zinc-600">{a.topic ?? "(no topic)"}</span>
                    }
                    <span className="ml-auto text-zinc-700 flex-shrink-0">
                      {Math.round((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24))}d ago
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Category breakdown ── */}
      {categories.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
            <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
            Published by Category <span className="text-zinc-700 font-normal normal-case">generate runs · 30 days</span>
          </h2>
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-zinc-900/60">
                  {["Category", "Published", "Errors", "Skipped", "Hit rate"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {categories.map((c) => {
                  const hitRate = c.published + c.error > 0
                    ? Math.round((c.published / (c.published + c.error)) * 100)
                    : 0;
                  return (
                    <tr key={c.name} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                          <span>{CATEGORY_EMOJI[c.name] ?? "📰"}</span>{c.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-emerald-400">{c.published}</td>
                      <td className="px-4 py-3 tabular-nums text-red-400/70">{c.error}</td>
                      <td className="px-4 py-3 tabular-nums text-zinc-600">{c.skipped}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className={`h-full rounded-full ${hitRate >= 70 ? "bg-emerald-500" : hitRate >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${hitRate}%` }}
                            />
                          </div>
                          <span className="text-[10px] tabular-nums text-zinc-500">{hitRate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Top sources ── */}
      {sources.top.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
            <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
            Top Sources <span className="text-zinc-700 font-normal normal-case">{sources.enabled} of {sources.total} active</span>
          </h2>
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-zinc-900/60">
                  {["Source", "All-time published", "Status"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {sources.top.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-xs font-semibold text-zinc-200">{s.name}</td>
                    <td className="px-4 py-2.5 tabular-nums text-zinc-300">{s.articles_published}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.enabled ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-600"}`}>
                        {s.enabled ? "active" : "paused"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Telegraph ── */}
      <section>
        <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
          Telegraph Performance
        </h2>
        <TelegraphStats />
      </section>
    </div>
  );
}
