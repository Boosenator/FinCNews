"use client";

import { useState } from "react";

type Action = "collect" | "generate" | "full";

type Result = {
  // collect
  itemsQueued?: number;
  itemsFound?: number;
  // generate
  articlesPublished?: number;
  queueSize?: number;
  // full run
  articlesFound?: number;
  error?: string;
};

const ACTIONS: { key: Action; label: string; endpoint: string; color: string }[] = [
  { key: "collect", label: "Collect RSS", endpoint: "/api/admin/collect", color: "border-white/[0.12] text-zinc-300 hover:border-cyan-400/40 hover:text-cyan-300" },
  { key: "generate", label: "Generate Articles", endpoint: "/api/admin/generate", color: "border-white/[0.12] text-zinc-300 hover:border-emerald-400/40 hover:text-emerald-300" },
  { key: "full", label: "▶ Full Run", endpoint: "/api/admin/run", color: "bg-cyan-400 text-zinc-950 hover:bg-cyan-300 border-transparent" },
];

export default function RunButton() {
  const [running, setRunning] = useState<Action | null>(null);
  const [last, setLast] = useState<{ action: Action; result: Result } | null>(null);

  async function run(action: Action, endpoint: string) {
    setRunning(action);
    setLast(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      setLast({ action, result: data });
    } catch (e) {
      setLast({ action, result: { error: String(e) } });
    }
    setRunning(null);
  }

  function summary(action: Action, result: Result): string {
    if (result.error) return `✗ ${result.error.slice(0, 80)}`;
    if (action === "collect") return `✓ Queued ${result.itemsQueued ?? 0} of ${result.itemsFound ?? 0} found`;
    if (action === "generate") return `✓ Published ${result.articlesPublished ?? 0} from queue of ${result.queueSize ?? 0}`;
    return `✓ Published ${result.articlesPublished ?? 0}`;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map(({ key, label, endpoint, color }) => (
          <button
            key={key}
            onClick={() => run(key, endpoint)}
            disabled={running !== null}
            className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-bold transition disabled:cursor-wait disabled:opacity-40 ${color}`}
          >
            {running === key && (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {running === key ? "Running..." : label}
          </button>
        ))}
      </div>
      {last && (
        <p className={`text-xs font-mono ${last.result.error ? "text-red-400" : "text-emerald-400"}`}>
          {summary(last.action, last.result)}
        </p>
      )}
    </div>
  );
}
