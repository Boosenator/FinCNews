"use client";

import { useState } from "react";

export default function RunButton() {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<string>("");

  async function run() {
    setState("running");
    setResult("");
    try {
      const res = await fetch("/api/admin/run", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult(`✓ Published: ${data.articlesPublished} | Found: ${data.articlesFound} | Skipped: ${data.articlesSkipped}`);
        setState("done");
      } else {
        setResult(data.error ?? "Unknown error");
        setState("error");
      }
    } catch (e) {
      setResult(String(e));
      setState("error");
    }
    setTimeout(() => setState("idle"), 8000);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={run}
        disabled={state === "running"}
        className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
          state === "running"
            ? "cursor-not-allowed bg-zinc-700 text-zinc-400"
            : "bg-cyan-400 text-zinc-950 hover:bg-cyan-300"
        }`}
      >
        {state === "running" ? (
          <>
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
            Running...
          </>
        ) : (
          "▶ Run Now"
        )}
      </button>
      {result && (
        <span className={`text-xs font-mono ${state === "error" ? "text-red-400" : "text-emerald-400"}`}>
          {result}
        </span>
      )}
    </div>
  );
}
