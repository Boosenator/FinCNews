"use client";

import { useState, useEffect, useCallback } from "react";

type QueueItem = {
  id:               string;
  url:              string;
  title:            string | null;
  snippet:          string | null;
  source_category:  string;
  source_name:      string | null;
  pub_date:         string | null;
  queued_at:        string;
  status:           string;
  score:            number;
  error_text:       string | null;
  urgency:          'breaking' | 'standard' | null;
  assigned_persona: string | null;
  expires_at:       string | null;
  article_type:     'new' | 'continuation' | null;
  continuation_of:  string | null;
};

const STATUS_TABS = ["pending", "processing", "error", "done"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 80 ? "bg-emerald-500/15 text-emerald-400"
    : score >= 60 ? "bg-cyan-500/15 text-cyan-400"
    : "bg-red-500/10 text-red-500";
  return <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${cls}`}>{score}</span>;
}

const PERSONA_SHORT: Record<string, string> = {
  'elena-voss':  'Elena',
  'marcus-webb': 'Marcus',
  'leo-cruz':    'Leo',
};

const PERSONA_COLOR: Record<string, string> = {
  'elena-voss':  'bg-violet-500/15 text-violet-400',
  'marcus-webb': 'bg-cyan-500/15 text-cyan-400',
  'leo-cruz':    'bg-amber-500/15 text-amber-400',
};

function expiresIn(expiresAt: string): { label: string; urgent: boolean } {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { label: 'expired', urgent: true };
  const m = Math.floor(ms / 60000);
  if (m < 60) return { label: `${m}m left`, urgent: m < 30 };
  return { label: `${Math.floor(m / 60)}h left`, urgent: false };
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

export default function QueueTab() {
  const [activeStatus, setActiveStatus] = useState<StatusTab>("pending");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const load = useCallback(async (status: StatusTab) => {
    setLoading(true);
    try {
      const res = await fetchWithTimeout(`/api/admin/queue?status=${status}`, {}, 20000);
      const data = await res.json();
      setItems(data.items ?? []);
    } catch (e) {
      setLastResult(e instanceof DOMException && e.name === "AbortError" ? "Error: queue request timed out" : `Error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(activeStatus);
  }, [activeStatus, load]);

  async function reject(id: string) {
    setRejecting(id);
    try {
      await fetchWithTimeout(`/api/admin/queue/${id}`, { method: "DELETE" }, 20000);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setLastResult("Rejected");
    } catch (e) {
      setLastResult(e instanceof DOMException && e.name === "AbortError" ? "Error: reject timed out" : `Error: ${String(e)}`);
    } finally {
      setRejecting(null);
    }
  }

  async function publishNow(id: string) {
    setPublishing(id);
    setLastResult(null);
    try {
      const res = await fetchWithTimeout(`/api/admin/queue/${id}`, { method: "POST" }, 290000);
      const data = await res.json();
      if (data.error) {
        setLastResult(`Error: ${data.error}`);
      } else {
        const detail = data.details?.[0];
        setLastResult(
          detail?.status === "published"
            ? `Published: "${detail.title}"`
            : `Failed: ${detail?.error ?? "unknown error"}`
        );
        setItems((prev) => prev.filter((i) => i.id !== id));
      }
    } catch (e) {
      setLastResult(e instanceof DOMException && e.name === "AbortError" ? "Error: publish timed out" : `Error: ${String(e)}`);
    } finally {
      setPublishing(null);
    }
  }

  async function clearAll() {
    if (!confirm(`Delete all ${items.length} pending items? This cannot be undone.`)) return;
    setClearing(true);
    try {
      const res = await fetchWithTimeout("/api/admin/queue", { method: "DELETE" }, 30000);
      const data = await res.json();
      setItems([]);
      setLastResult(`Cleared ${data.deleted} items`);
    } catch (e) {
      setLastResult(e instanceof DOMException && e.name === "AbortError" ? "Error: clear timed out" : `Error: ${String(e)}`);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Article Queue</h1>
          <p className="mt-1 text-sm text-zinc-500">Manage scheduled publications — reject, reorder, or publish immediately</p>
        </div>
        {activeStatus === "pending" && items.length > 0 && (
          <button
            onClick={clearAll}
            disabled={clearing}
            className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-40"
          >
            {clearing ? "Clearing…" : `Clear all (${items.length})`}
          </button>
        )}
      </div>

      {/* Result toast */}
      {lastResult && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          lastResult.startsWith("Error") || lastResult.startsWith("Failed")
            ? "border-red-500/20 bg-red-500/5 text-red-400"
            : "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
        }`}>
          {lastResult}
          <button onClick={() => setLastResult(null)} className="ml-3 text-current opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-zinc-900/40 p-1">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setActiveStatus(s)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
              activeStatus === s ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
        {loading ? (
          <div className="py-12 text-center text-xs text-zinc-600">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-600">No {activeStatus} items</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-zinc-900/60">
                {["Score", "Title", "Persona", "Source", "Age / Expires", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {items.map((item) => {
                const isPublishing = publishing === item.id;
                const isRejecting = rejecting === item.id;
                const busy = isPublishing || isRejecting;

                return (
                  <tr key={item.id} className={`transition hover:bg-white/[0.02] ${busy ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      <ScoreBadge score={item.score} />
                    </td>
                    <td className="px-4 py-3 max-w-[340px]">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          {item.urgency === 'breaking' && (
                            <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-400 uppercase">🔥 Breaking</span>
                          )}
                          {item.article_type === 'continuation' && (
                            <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-bold text-indigo-400">↩ continuation</span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-xs font-medium text-zinc-200">
                          {item.title ?? <span className="italic text-zinc-600">No title</span>}
                        </p>
                        {item.error_text && (
                          <p className="mt-0.5 truncate text-[10px] text-red-400">{item.error_text}</p>
                        )}
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 block truncate text-[10px] text-zinc-600 hover:text-zinc-400"
                        >
                          {item.url.replace(/^https?:\/\//, "").slice(0, 60)}
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.assigned_persona ? (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PERSONA_COLOR[item.assigned_persona] ?? "bg-zinc-700 text-zinc-400"}`}>
                          {PERSONA_SHORT[item.assigned_persona] ?? item.assigned_persona}
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-zinc-400">
                        {item.source_name ?? item.source_category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] tabular-nums text-zinc-600">
                      <div>{timeAgo(item.queued_at)}</div>
                      {item.expires_at && (() => {
                        const exp = expiresIn(item.expires_at);
                        return (
                          <div className={exp.urgent ? "font-semibold text-red-400" : "text-zinc-700"}>
                            ⏱ {exp.label}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {activeStatus === "pending" && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => publishNow(item.id)}
                            disabled={busy}
                            title="Publish now"
                            className="rounded border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 transition hover:bg-emerald-500/15 disabled:cursor-wait disabled:opacity-40"
                          >
                            {isPublishing ? (
                              <span className="flex items-center gap-1">
                                <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
                                Publishing…
                              </span>
                            ) : "▶ Now"}
                          </button>
                          <button
                            onClick={() => reject(item.id)}
                            disabled={busy}
                            title="Reject"
                            className="rounded border border-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-zinc-500 transition hover:border-red-500/20 hover:text-red-400 disabled:opacity-40"
                          >
                            {isRejecting ? "…" : "✕"}
                          </button>
                        </div>
                      )}
                      {activeStatus === "error" && (
                        <button
                          onClick={() => reject(item.id)}
                          disabled={busy}
                          className="rounded border border-white/[0.06] px-2.5 py-1 text-[11px] text-zinc-500 transition hover:border-red-500/20 hover:text-red-400"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Refresh */}
      <div className="flex justify-end">
        <button
          onClick={() => load(activeStatus)}
          disabled={loading}
          className="text-[11px] text-zinc-600 hover:text-zinc-400 disabled:opacity-40"
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  );
}
