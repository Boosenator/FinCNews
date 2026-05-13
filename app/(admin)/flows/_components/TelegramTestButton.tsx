"use client";

import { useState } from "react";

type Result = {
  ok?: boolean;
  messageId?: number;
  chat?: string;
  error?: string;
  code?: number;
};

export default function TelegramTestButton() {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);

  async function test() {
    setState("loading");
    try {
      const res = await fetch("/api/admin/test-telegram", { method: "POST" });
      const data = await res.json();
      setResult(data);
      setState(data.ok ? "ok" : "error");
    } catch (e) {
      setResult({ error: String(e) });
      setState("error");
    }
    setTimeout(() => setState("idle"), 8000);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
          Telegram
        </span>
        <button
          onClick={test}
          disabled={state === "loading"}
          className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
            state === "ok"
              ? "border-emerald-400/30 text-emerald-400"
              : state === "error"
              ? "border-red-400/30 text-red-400"
              : "border-white/[0.10] text-zinc-400 hover:border-cyan-400/30 hover:text-cyan-300"
          } disabled:cursor-wait disabled:opacity-40`}
        >
          {state === "loading" ? "Sending..." :
           state === "ok"    ? "✓ Sent!" :
           state === "error" ? "✗ Failed" :
           "Send test message"}
        </button>
      </div>

      {result && state !== "idle" && (
        <p className={`text-[10px] font-mono ${result.ok ? "text-emerald-400" : "text-red-400"}`}>
          {result.ok
            ? `Message #${result.messageId} → ${result.chat}`
            : `Error ${result.code ?? ""}: ${result.error}`}
        </p>
      )}
    </div>
  );
}
