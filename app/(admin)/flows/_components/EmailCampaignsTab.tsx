"use client";

import { useState, useEffect, useCallback } from "react";

type Campaign = {
  id: string;
  type: "breaking" | "digest";
  status: "draft" | "sent" | "rejected";
  subject: string;
  preheader: string | null;
  headline: string | null;
  excerpt: string | null;
  article_slug: string | null;
  article_url: string | null;
  articles: Array<{
    headline: string;
    excerpt: string;
    category: string;
    slug: string;
    url: string;
  }>;
  recipients_count: number | null;
  sent_at: string | null;
  rejected_at: string | null;
  agent_notes: string | null;
  created_at: string;
};

type Data = {
  campaigns: Campaign[];
  confirmedSubscribers: number;
};

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function extractLinks(campaign: Campaign): string[] {
  if (campaign.type === "breaking" && campaign.article_url) {
    return [campaign.article_url];
  }
  return campaign.articles.map((a) => a.url);
}

// ─── Preview modal ────────────────────────────────────────────────────────────

function PreviewModal({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const links = extractLinks(campaign);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">
              {campaign.type === "breaking" ? "Breaking Alert" : "Weekly Digest"}
            </p>
            <h2 className="mt-0.5 text-base font-bold text-white">{campaign.subject}</h2>
            {campaign.preheader && (
              <p className="mt-0.5 text-xs text-zinc-500">{campaign.preheader}</p>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6 space-y-6">
          {/* Content preview */}
          {campaign.type === "breaking" ? (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-cyan-400">Breaking</p>
              <h3 className="mb-2 text-lg font-bold text-white leading-snug">{campaign.headline}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{campaign.excerpt}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {campaign.articles.map((a, i) => (
                <div key={i} className="border-t border-white/[0.06] pt-4 first:border-0 first:pt-0">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{a.category}</p>
                  <p className="mb-1 text-sm font-semibold text-white leading-snug">{a.headline}</p>
                  <p className="text-xs leading-relaxed text-zinc-500">{a.excerpt}</p>
                </div>
              ))}
            </div>
          )}

          {/* UTM links */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              Links ({links.length})
            </p>
            <div className="space-y-1.5">
              {links.map((link, i) => {
                const u = new URL(link);
                const path = u.pathname;
                const utm = [
                  u.searchParams.get("utm_source"),
                  u.searchParams.get("utm_medium"),
                  u.searchParams.get("utm_campaign"),
                  u.searchParams.get("utm_content"),
                ].filter(Boolean).join(" · ");
                return (
                  <div key={i} className="rounded-lg bg-zinc-900/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-mono text-xs text-cyan-400 hover:underline"
                      >
                        {path}
                      </a>
                      <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                        ✓ UTM
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-zinc-600">{utm}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agent notes */}
          {campaign.agent_notes && (
            <div className="rounded-lg border border-white/[0.05] bg-zinc-900/40 px-4 py-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Agent notes</p>
              <p className="text-xs leading-relaxed text-zinc-500">{campaign.agent_notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Campaign card ────────────────────────────────────────────────────────────

function CampaignCard({
  campaign,
  confirmedSubscribers,
  onPreview,
  onSend,
  onReject,
  busy,
}: {
  campaign: Campaign;
  confirmedSubscribers: number;
  onPreview: () => void;
  onSend: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const isDraft = campaign.status === "draft";
  const isSent = campaign.status === "sent";

  return (
    <div className={`rounded-xl border bg-zinc-900/40 ${
      isDraft ? "border-white/[0.08]" : isSent ? "border-emerald-500/10" : "border-white/[0.03] opacity-50"
    }`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Type + status badges */}
            <div className="mb-2 flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                campaign.type === "breaking"
                  ? "bg-orange-500/10 text-orange-400"
                  : "bg-violet-500/10 text-violet-400"
              }`}>
                {campaign.type === "breaking" ? "Breaking" : "Digest"}
              </span>
              <span className={`text-[10px] font-semibold ${
                isDraft ? "text-amber-400" : isSent ? "text-emerald-400" : "text-zinc-600"
              }`}>
                {isDraft ? "Draft" : isSent ? `Sent to ${campaign.recipients_count}` : "Rejected"}
              </span>
              <span className="text-[10px] text-zinc-700">{timeAgo(campaign.created_at)}</span>
            </div>

            {/* Subject */}
            <p className="text-sm font-bold text-white">{campaign.subject}</p>
            {campaign.preheader && (
              <p className="mt-0.5 text-xs text-zinc-500">{campaign.preheader}</p>
            )}

            {/* Headline / articles summary */}
            {campaign.type === "breaking" && campaign.headline && (
              <p className="mt-2 text-xs text-zinc-400 line-clamp-2">{campaign.headline}</p>
            )}
            {campaign.type === "digest" && campaign.articles.length > 0 && (
              <p className="mt-2 text-xs text-zinc-600">
                {campaign.articles.length} articles · {campaign.articles.map(a => a.category).filter((v, i, a) => a.indexOf(v) === i).join(", ")}
              </p>
            )}
          </div>

          {/* Recipient count */}
          {isDraft && (
            <div className="shrink-0 text-right">
              <p className="text-xl font-black tabular-nums text-white">{confirmedSubscribers}</p>
              <p className="text-[10px] text-zinc-600">recipients</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {isDraft && (
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={onPreview}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-400 transition hover:border-white/20 hover:text-white"
            >
              Preview
            </button>
            <button
              onClick={onSend}
              disabled={busy || confirmedSubscribers === 0}
              className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
                  Sending…
                </span>
              ) : `Send to ${confirmedSubscribers}`}
            </button>
            <button
              onClick={onReject}
              disabled={busy}
              className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-red-500/20 hover:text-red-400 disabled:opacity-40"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatsStrip({ campaigns }: { campaigns: Campaign[] }) {
  const sent = campaigns.filter(c => c.status === "sent");
  const totalReach = sent.reduce((s, c) => s + (c.recipients_count ?? 0), 0);
  const breaking = sent.filter(c => c.type === "breaking").length;
  const digest = sent.filter(c => c.type === "digest").length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { label: "Campaigns sent", value: sent.length },
        { label: "Total reach", value: totalReach.toLocaleString() },
        { label: "Breaking alerts", value: breaking },
        { label: "Digests", value: digest },
      ].map(({ label, value }) => (
        <div key={label} className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{label}</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-white">{value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

type StatusFilter = "draft" | "sent" | "rejected" | "all";

export default function EmailCampaignsTab() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<Campaign | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("draft");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/email-campaigns");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function runAgent() {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/email-campaigns", { method: "POST" });
      const d = await res.json();
      if (d.ok) {
        showToast(`Agent created ${d.breakingDrafts} breaking + ${d.digestDrafts} digest drafts from ${d.articlesEvaluated} articles`, true);
        await load();
      } else {
        showToast(`Agent error: ${d.error}`, false);
      }
    } catch (e) {
      showToast(`Error: ${String(e)}`, false);
    } finally {
      setRunning(false);
    }
  }

  async function sendCampaign(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}`, { method: "POST" });
      const d = await res.json();
      if (d.ok) {
        showToast(`Sent to ${d.sent} subscribers (${d.failed} failed)`, true);
        await load();
      } else {
        showToast(`Send error: ${d.error}`, false);
      }
    } finally {
      setBusy(null);
    }
  }

  async function rejectCampaign(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/admin/email-campaigns/${id}`, { method: "DELETE" });
      showToast("Campaign rejected", true);
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="py-20 text-center text-xs text-zinc-600">Loading…</div>;

  const campaigns = data?.campaigns ?? [];
  const confirmedSubscribers = data?.confirmedSubscribers ?? 0;
  const filtered = filter === "all" ? campaigns : campaigns.filter(c => c.status === filter);
  const draftCount = campaigns.filter(c => c.status === "draft").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Email Campaigns</h1>
          <p className="mt-1 text-sm text-zinc-500">
            AI-planned breaking alerts and weekly digests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-[11px] text-zinc-600 hover:text-zinc-400">↻ Refresh</button>
          <button
            onClick={runAgent}
            disabled={running}
            className="flex items-center gap-2 rounded-lg bg-cyan-400/10 border border-cyan-400/20 px-4 py-2 text-sm font-bold text-cyan-400 transition hover:bg-cyan-400/20 disabled:opacity-50"
          >
            {running ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                Planning…
              </>
            ) : "Run agent"}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          toast.ok ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                   : "border-red-500/20 bg-red-500/5 text-red-400"
        }`}>
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-3 opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Stats */}
      <StatsStrip campaigns={campaigns} />

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-zinc-900/40 p-1">
        {(["draft", "sent", "rejected", "all"] as StatusFilter[]).map((f) => {
          const count = f === "all" ? campaigns.length : campaigns.filter(c => c.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                filter === f ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {f === "draft" && draftCount > 0 ? (
                <span className="flex items-center justify-center gap-1.5">
                  Draft
                  <span className="rounded-full bg-amber-400/20 px-1.5 text-[9px] font-black text-amber-400">{draftCount}</span>
                </span>
              ) : `${f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)} (${count})`}
            </button>
          );
        })}
      </div>

      {/* Campaign list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-zinc-600">
              {filter === "draft" ? "No drafts — run the agent to create campaigns" : `No ${filter} campaigns`}
            </p>
          </div>
        ) : (
          filtered.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              confirmedSubscribers={confirmedSubscribers}
              onPreview={() => setPreview(c)}
              onSend={() => sendCampaign(c.id)}
              onReject={() => rejectCampaign(c.id)}
              busy={busy === c.id}
            />
          ))
        )}
      </div>

      {/* Preview modal */}
      {preview && <PreviewModal campaign={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
