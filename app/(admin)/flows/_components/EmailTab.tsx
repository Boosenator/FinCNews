"use client";

import { useState, useEffect, useCallback } from "react";

type Stats = {
  total: number;
  confirmed: number;
  pending: number;
  unsubscribed: number;
};

type EmailLog = {
  id: string;
  type: "confirmation" | "welcome" | "breaking" | "digest";
  recipient: string;
  subject: string | null;
  status: "sent" | "failed";
  resend_id: string | null;
  error: string | null;
  sent_at: string;
};

type Subscriber = {
  email: string;
  status: "pending" | "confirmed" | "unsubscribed";
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
};

type Data = {
  stats: Stats;
  logs: EmailLog[];
  subscribers: Subscriber[];
};

const TYPE_LABEL: Record<EmailLog["type"], string> = {
  confirmation: "DOI",
  welcome: "Welcome",
  breaking: "Breaking",
  digest: "Digest",
};

const TYPE_COLOR: Record<EmailLog["type"], string> = {
  confirmation: "bg-cyan-500/10 text-cyan-400",
  welcome: "bg-emerald-500/10 text-emerald-400",
  breaking: "bg-orange-500/10 text-orange-400",
  digest: "bg-violet-500/10 text-violet-400",
};

const STATUS_COLOR: Record<Subscriber["status"], string> = {
  confirmed: "text-emerald-400",
  pending: "text-amber-400",
  unsubscribed: "text-zinc-600",
};

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" });
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">{label}</p>
      <p className="mt-1.5 text-3xl font-black tabular-nums text-white">{value.toLocaleString()}</p>
      {sub && <p className="mt-1 text-[11px] text-zinc-600">{sub}</p>}
    </div>
  );
}

type SubTab = "logs" | "subscribers" | "unsubscribed";

export default function EmailTab() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<SubTab>("logs");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/subscribers");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="py-20 text-center text-xs text-zinc-600">Loading…</div>;
  }

  if (!data) {
    return <div className="py-20 text-center text-xs text-red-400">Failed to load data</div>;
  }

  const { stats, logs, subscribers } = data;
  const confirmRate = stats.total > 0
    ? Math.round((stats.confirmed / (stats.total - stats.unsubscribed)) * 100)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Email</h1>
          <p className="mt-1 text-sm text-zinc-500">Subscriber base and outbound email history</p>
        </div>
        <button
          onClick={load}
          className="text-[11px] text-zinc-600 hover:text-zinc-400"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard
          label="Confirmed"
          value={stats.confirmed}
          sub={stats.total > 0 ? `${confirmRate}% confirm rate` : undefined}
        />
        <StatCard label="Pending DOI" value={stats.pending} />
        <StatCard label="Unsubscribed" value={stats.unsubscribed} />
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-zinc-900/40 p-1">
        {(["logs", "subscribers", "unsubscribed"] as SubTab[]).map((t) => {
          const label =
            t === "logs" ? `Email Sends (${logs.length})`
            : t === "subscribers" ? `Active (${subscribers.filter(s => s.status !== "unsubscribed").length})`
            : `Unsubscribed (${subscribers.filter(s => s.status === "unsubscribed").length})`;
          return (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                subTab === t ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Email Logs */}
      {subTab === "logs" && (
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          {logs.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-600">No emails sent yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-zinc-900/60">
                  {["Type", "Recipient", "Subject", "Status", "Sent"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {logs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${TYPE_COLOR[log.type]}`}>
                        {TYPE_LABEL[log.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {maskEmail(log.recipient)}
                    </td>
                    <td className="max-w-[240px] px-4 py-3 text-xs text-zinc-500 truncate">
                      {log.subject ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {log.status === "sent" ? (
                        <span className="text-xs text-emerald-400">Sent</span>
                      ) : (
                        <span className="text-xs text-red-400" title={log.error ?? ""}>
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] tabular-nums text-zinc-600">
                      {timeAgo(log.sent_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Subscribers */}
      {subTab === "subscribers" && (() => {
        const active = subscribers.filter(s => s.status !== "unsubscribed");
        return (
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            {active.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-600">No active subscribers yet</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-zinc-900/60">
                    {["Email", "Status", "Confirmed", "Signed up"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {active.map((sub, i) => (
                    <tr key={i} className="transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400">{maskEmail(sub.email)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold capitalize ${STATUS_COLOR[sub.status]}`}>{sub.status}</span>
                      </td>
                      <td className="px-4 py-3 text-[11px] tabular-nums text-zinc-600">
                        {sub.confirmed_at ? timeAgo(sub.confirmed_at) : "—"}
                      </td>
                      <td className="px-4 py-3 text-[11px] tabular-nums text-zinc-600">
                        {timeAgo(sub.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })()}

      {subTab === "unsubscribed" && (() => {
        const unsubs = subscribers.filter(s => s.status === "unsubscribed");
        return (
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            {unsubs.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-600">No unsubscribes yet</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-zinc-900/60">
                    {["Email", "Unsubscribed", "Was confirmed", "Signed up"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {unsubs
                    .sort((a, b) => new Date(b.unsubscribed_at ?? b.created_at).getTime() - new Date(a.unsubscribed_at ?? a.created_at).getTime())
                    .map((sub, i) => (
                      <tr key={i} className="transition hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-mono text-xs text-zinc-600">{maskEmail(sub.email)}</td>
                        <td className="px-4 py-3 text-[11px] tabular-nums text-zinc-500">
                          {sub.unsubscribed_at ? timeAgo(sub.unsubscribed_at) : "—"}
                        </td>
                        <td className="px-4 py-3 text-[11px] tabular-nums text-zinc-600">
                          {sub.confirmed_at ? timeAgo(sub.confirmed_at) : <span className="text-zinc-700">never confirmed</span>}
                        </td>
                        <td className="px-4 py-3 text-[11px] tabular-nums text-zinc-600">
                          {timeAgo(sub.created_at)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })()}
    </div>
  );
}
