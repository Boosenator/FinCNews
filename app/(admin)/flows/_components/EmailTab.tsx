"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Stats = { total: number; confirmed: number; pending: number; unsubscribed: number };

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

type InboundLog = {
  id: string;
  from_address: string;
  to_address: string;
  subject: string | null;
  forwarded_to: string | null;
  status: "forwarded" | "skipped" | "failed";
  skip_reason: string | null;
  received_at: string;
};

type EmailRoute = {
  id: string;
  recipient: string;
  forward_to: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
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
  inboundLogs: InboundLog[];
  routes: EmailRoute[];
  subscribers: Subscriber[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<EmailLog["type"], string> = {
  confirmation: "bg-cyan-500/10 text-cyan-400",
  welcome:      "bg-emerald-500/10 text-emerald-400",
  breaking:     "bg-orange-500/10 text-orange-400",
  digest:       "bg-violet-500/10 text-violet-400",
};

const INBOUND_STATUS_COLOR: Record<InboundLog["status"], string> = {
  forwarded: "text-emerald-400",
  skipped:   "text-zinc-500",
  failed:    "text-red-400",
};

const SUB_STATUS_COLOR: Record<Subscriber["status"], string> = {
  confirmed:    "text-emerald-400",
  pending:      "text-amber-400",
  unsubscribed: "text-zinc-600",
};

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local?.slice(0, 2) ?? ""}***@${domain ?? ""}`;
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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

type SubTab = "outbound" | "inbound" | "routes" | "subscribers" | "unsubscribed";

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmailTab() {
  const [data,      setData]      = useState<Data | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [subTab,    setSubTab]    = useState<SubTab>("inbound");
  const [busyUnsub, setBusyUnsub] = useState<string | null>(null);

  // Route form state
  const [newRecipient,  setNewRecipient]  = useState("");
  const [newForwardTo,  setNewForwardTo]  = useState("");
  const [newLabel,      setNewLabel]      = useState("");
  const [savingRoute,   setSavingRoute]   = useState(false);
  const [routeError,    setRouteError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/subscribers");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const unsubscribeUser = async (email: string) => {
    if (!confirm(`Unsubscribe ${email}?`)) return;
    setBusyUnsub(email);
    try {
      await fetch("/api/admin/subscribers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      await load();
    } finally {
      setBusyUnsub(null);
    }
  };

  const toggleRoute = async (id: string, is_active: boolean) => {
    await fetch("/api/admin/email-routes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active }),
    });
    await load();
  };

  const deleteRoute = async (id: string, recipient: string) => {
    if (!confirm(`Delete route for "${recipient}"?`)) return;
    await fetch("/api/admin/email-routes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  };

  const saveRoute = async () => {
    setRouteError(null);
    if (!newRecipient.trim() || !newForwardTo.trim()) {
      setRouteError("Recipient and forward address are required");
      return;
    }
    setSavingRoute(true);
    try {
      const res = await fetch("/api/admin/email-routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: newRecipient, forward_to: newForwardTo, label: newLabel }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        setRouteError(j.error ?? "Failed to save");
      } else {
        setNewRecipient(""); setNewForwardTo(""); setNewLabel("");
        await load();
      }
    } finally {
      setSavingRoute(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-xs text-zinc-600">Loading…</div>;
  if (!data)   return <div className="py-20 text-center text-xs text-red-400">Failed to load data</div>;

  const { stats, logs, inboundLogs, routes, subscribers } = data;
  const confirmRate = stats.total > 0
    ? Math.round((stats.confirmed / Math.max(stats.total - stats.unsubscribed, 1)) * 100) : 0;

  const TABS: { key: SubTab; label: string }[] = [
    { key: "inbound",     label: `Inbound (${inboundLogs.length})` },
    { key: "outbound",    label: `Outbound (${logs.length})` },
    { key: "routes",      label: `Routes (${routes.length})` },
    { key: "subscribers", label: `Active (${subscribers.filter(s => s.status !== "unsubscribed").length})` },
    { key: "unsubscribed",label: `Unsub (${subscribers.filter(s => s.status === "unsubscribed").length})` },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Email</h1>
          <p className="mt-1 text-sm text-zinc-500">Inbound routing, outbound history, subscribers</p>
        </div>
        <button onClick={load} className="text-[11px] text-zinc-600 hover:text-zinc-400">↻ Refresh</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total"       value={stats.total} />
        <StatCard label="Confirmed"   value={stats.confirmed} sub={`${confirmRate}% confirm rate`} />
        <StatCard label="Pending DOI" value={stats.pending} />
        <StatCard label="Unsubscribed" value={stats.unsubscribed} />
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-white/[0.06] bg-zinc-900/40 p-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              subTab === key ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Inbound ─────────────────────────────────────────────────────── */}
      {subTab === "inbound" && (
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          {inboundLogs.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-600">No inbound emails yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-zinc-900/60">
                  {["To", "From", "Subject", "Forwarded to", "Status", "Time"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {inboundLogs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs text-cyan-400">{log.to_address}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">{maskEmail(log.from_address)}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-zinc-500">{log.subject ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{log.forwarded_to ? maskEmail(log.forwarded_to) : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold capitalize ${INBOUND_STATUS_COLOR[log.status]}`}
                            title={log.skip_reason ?? ""}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] tabular-nums text-zinc-600">{timeAgo(log.received_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Outbound ────────────────────────────────────────────────────── */}
      {subTab === "outbound" && (
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          {logs.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-600">No outbound emails yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-zinc-900/60">
                  {["Type", "Recipient", "Subject", "Status", "Sent"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {logs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${TYPE_COLOR[log.type]}`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">{maskEmail(log.recipient)}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-xs text-zinc-500">{log.subject ?? "—"}</td>
                    <td className="px-4 py-3">
                      {log.status === "sent"
                        ? <span className="text-xs text-emerald-400">Sent</span>
                        : <span className="text-xs text-red-400" title={log.error ?? ""}>Failed</span>}
                    </td>
                    <td className="px-4 py-3 text-[11px] tabular-nums text-zinc-600">{timeAgo(log.sent_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Routes ──────────────────────────────────────────────────────── */}
      {subTab === "routes" && (
        <div className="space-y-4">
          {/* Add route form */}
          <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-500">Add / Update Route</p>
            <div className="flex flex-wrap gap-2">
              <input
                placeholder="recipient (e.g. editorial or *)"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                className="flex-1 min-w-[140px] rounded-lg border border-white/[0.08] bg-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/40"
              />
              <input
                placeholder="forward to (email)"
                value={newForwardTo}
                onChange={(e) => setNewForwardTo(e.target.value)}
                className="flex-1 min-w-[180px] rounded-lg border border-white/[0.08] bg-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/40"
              />
              <input
                placeholder="label (optional)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-[120px] rounded-lg border border-white/[0.08] bg-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/40"
              />
              <button
                onClick={saveRoute}
                disabled={savingRoute}
                className="rounded-lg bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-400 transition hover:bg-cyan-500/20 disabled:opacity-40"
              >
                {savingRoute ? "Saving…" : "Save"}
              </button>
            </div>
            {routeError && <p className="mt-2 text-[11px] text-red-400">{routeError}</p>}
            <p className="mt-2 text-[10px] text-zinc-700">
              Use <code className="text-zinc-500">*</code> as recipient for catch-all.
              Subject format: <code className="text-zinc-500">[finc.news &gt; recipient] Original Subject</code>
            </p>
          </div>

          {/* Routes table */}
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            {routes.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-600">No routes configured</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-zinc-900/60">
                    {["Recipient", "Label", "Forward to", "Active", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {routes.map((route) => (
                    <tr key={route.id} className="transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-mono text-xs text-cyan-400">
                        {route.recipient === "*" ? <span className="text-zinc-400">* (catch-all)</span> : `${route.recipient}@e.finc.news`}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{route.label ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                        {route.forward_to || <span className="text-red-400/60 italic">not set</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleRoute(route.id, !route.is_active)}
                          className={`text-xs font-semibold transition ${route.is_active ? "text-emerald-400 hover:text-zinc-400" : "text-zinc-600 hover:text-emerald-400"}`}
                        >
                          {route.is_active ? "On" : "Off"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteRoute(route.id, route.recipient)}
                          className="text-[10px] text-zinc-700 transition hover:text-red-400"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Subscribers ─────────────────────────────────────────────────── */}
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
                    {["Email", "Status", "Confirmed", "Signed up", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {active.map((sub, i) => (
                    <tr key={i} className="transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400">{maskEmail(sub.email)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold capitalize ${SUB_STATUS_COLOR[sub.status]}`}>{sub.status}</span>
                      </td>
                      <td className="px-4 py-3 text-[11px] tabular-nums text-zinc-600">{sub.confirmed_at ? timeAgo(sub.confirmed_at) : "—"}</td>
                      <td className="px-4 py-3 text-[11px] tabular-nums text-zinc-600">{timeAgo(sub.created_at)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => unsubscribeUser(sub.email)}
                          disabled={busyUnsub === sub.email}
                          className="rounded border border-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-zinc-600 transition hover:border-red-500/20 hover:text-red-400 disabled:opacity-40"
                        >
                          {busyUnsub === sub.email ? "…" : "Unsub"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })()}

      {/* ── Unsubscribed ─────────────────────────────────────────────────── */}
      {subTab === "unsubscribed" && (() => {
        const unsubs = subscribers.filter(s => s.status === "unsubscribed")
          .sort((a, b) => new Date(b.unsubscribed_at ?? b.created_at).getTime() - new Date(a.unsubscribed_at ?? a.created_at).getTime());
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
                  {unsubs.map((sub, i) => (
                    <tr key={i} className="transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-600">{maskEmail(sub.email)}</td>
                      <td className="px-4 py-3 text-[11px] tabular-nums text-zinc-500">{sub.unsubscribed_at ? timeAgo(sub.unsubscribed_at) : "—"}</td>
                      <td className="px-4 py-3 text-[11px] tabular-nums text-zinc-600">{sub.confirmed_at ? timeAgo(sub.confirmed_at) : <span className="text-zinc-700">never</span>}</td>
                      <td className="px-4 py-3 text-[11px] tabular-nums text-zinc-600">{timeAgo(sub.created_at)}</td>
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
