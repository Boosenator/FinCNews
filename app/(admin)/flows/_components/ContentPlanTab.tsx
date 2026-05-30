"use client";

import { useCallback, useEffect, useState } from "react";

type TopicPlan = {
  slug: string;
  title: string;
  keywords: string[];
  status: "planned" | "published";
  updatedAt: string | null;
  currentTitle: string | null;
  relatedCount: number;
  url: string | null;
};

type AgentResult = {
  ok?: boolean;
  slug?: string;
  title?: string;
  relatedArticles?: number;
  sanityId?: string;
  error?: string;
};

function timeAgo(d: string | null) {
  if (!d) return "never";
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 70000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export default function ContentPlanTab() {
  const [topics, setTopics] = useState<TopicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AgentResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithTimeout("/api/admin/editorial", {}, 20000);
      const data = await res.json();
      setTopics(data.topics ?? []);
    } catch (e) {
      setLastResult({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(slug?: string) {
    setRunning(slug ?? "__auto__");
    setLastResult(null);
    try {
      const res = await fetchWithTimeout(
        "/api/admin/editorial",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slug ? { slug } : {}),
        },
        70000,
      );
      const data = await res.json();
      setLastResult(data);
      await load();
    } catch (e) {
      setLastResult({ error: e instanceof DOMException && e.name === "AbortError" ? "Editorial agent timed out" : String(e) });
    } finally {
      setRunning(null);
    }
  }

  const published = topics.filter((t) => t.status === "published").length;
  const planned = topics.length - published;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Content Plan</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Authority topic hubs maintained by the editorial agent.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => load()}
            disabled={loading || running !== null}
            className="rounded-lg border border-white/[0.08] px-3.5 py-2 text-sm font-semibold text-zinc-400 transition hover:border-white/[0.16] hover:text-white disabled:opacity-40"
          >
            Refresh
          </button>
          <button
            onClick={() => run()}
            disabled={running !== null}
            className="flex items-center gap-2 rounded-lg border border-transparent bg-cyan-400 px-3.5 py-2 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-40"
          >
            {running === "__auto__" && <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            {running === "__auto__" ? "Running..." : "Run next hub"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Planned topics", value: String(topics.length), sub: "agent scope" },
          { label: "Published hubs", value: String(published), sub: `${planned} remaining` },
          { label: "Related articles", value: String(topics.reduce((sum, t) => sum + t.relatedCount, 0)), sub: "coverage signals" },
          { label: "Next target", value: topics.find((t) => t.status === "planned")?.title ?? topics[0]?.title ?? "-", sub: "oldest missing" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{s.label}</p>
            <p className="mt-1.5 truncate text-2xl font-black text-white">{s.value}</p>
            <p className="text-[10px] text-zinc-600">{s.sub}</p>
          </div>
        ))}
      </div>

      {lastResult && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          lastResult.error
            ? "border-red-500/20 bg-red-500/5 text-red-400"
            : "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
        }`}>
          {lastResult.error
            ? lastResult.error
            : `Published ${lastResult.title} from ${lastResult.relatedArticles ?? 0} related articles`}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
        {loading ? (
          <div className="py-12 text-center text-xs text-zinc-600">Loading content plan...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-zinc-900/60">
                {["Topic", "Status", "Coverage", "Updated", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {topics.map((topic) => {
                const isRunning = running === topic.slug;
                return (
                  <tr key={topic.slug} className={isRunning ? "opacity-60" : ""}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-zinc-100">{topic.title}</p>
                      <div className="mt-1 flex max-w-[420px] flex-wrap gap-1">
                        {topic.keywords.slice(0, 5).map((kw) => (
                          <span key={kw} className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                        topic.status === "published" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                      }`}>
                        {topic.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-zinc-400">
                      {topic.relatedCount} articles
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">
                      {timeAgo(topic.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => run(topic.slug)}
                          disabled={running !== null}
                          className="flex items-center gap-1.5 rounded border border-cyan-400/20 bg-cyan-400/5 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 transition hover:bg-cyan-400/10 disabled:cursor-wait disabled:opacity-40"
                        >
                          {isRunning && <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />}
                          {topic.status === "published" ? "Refresh hub" : "Create hub"}
                        </button>
                        {topic.url && (
                          <a
                            href={topic.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded border border-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-zinc-500 transition hover:text-white"
                          >
                            View
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
