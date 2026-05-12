"use client";

import { useState } from "react";

type Item = {
  title: string;
  link: string;
  pubDate: string;
  snippet: string;
  matchedKeywords: string[];
};

type TestResult = {
  source: { name: string; url: string; category: string };
  totalItems: number;
  items: Item[];
  error?: string;
};

export default function TestSourceButton({ id, name }: { id: string; name: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<TestResult | null>(null);
  const [open, setOpen] = useState(false);

  async function test() {
    setState("loading");
    setOpen(true);
    try {
      const res = await fetch(`/api/admin/sources/${id}/test`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ source: { name, url: "", category: "" }, totalItems: 0, items: [], error: String(e) });
    }
    setState("done");
  }

  return (
    <div>
      <button
        onClick={test}
        disabled={state === "loading"}
        className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold transition ${
          state === "loading"
            ? "border-white/[0.06] text-zinc-600 cursor-wait"
            : "border-white/[0.08] text-zinc-500 hover:border-cyan-400/30 hover:text-cyan-400"
        }`}
      >
        {state === "loading" ? "..." : "Test"}
      </button>

      {open && result && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/80 p-4 backdrop-blur-sm pt-16">
          <div className="w-full max-w-2xl rounded-xl border border-white/[0.08] bg-zinc-900 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div>
                <p className="text-sm font-bold text-white">{result.source.name}</p>
                <p className="text-[10px] text-zinc-500 truncate">{result.source.url}</p>
              </div>
              <div className="flex items-center gap-3">
                {!result.error && (
                  <span className="text-xs text-zinc-500">
                    {result.totalItems} items found
                  </span>
                )}
                <button
                  onClick={() => { setOpen(false); setState("idle"); }}
                  className="rounded-md border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Error */}
            {result.error && (
              <div className="p-5">
                <p className="text-sm text-red-400">Error: {result.error}</p>
              </div>
            )}

            {/* Items */}
            {!result.error && result.items.length === 0 && (
              <div className="p-5 text-center text-sm text-zinc-600">
                No items parsed — check the RSS URL format
              </div>
            )}

            {!result.error && result.items.length > 0 && (
              <div className="divide-y divide-white/[0.04] max-h-[60vh] overflow-y-auto">
                {result.items.map((item, i) => (
                  <div key={i} className="p-4">
                    <div className="flex items-start gap-2 mb-2">
                      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                        item.matchedKeywords.length > 0
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-zinc-700/50 text-zinc-500"
                      }`}>
                        {item.matchedKeywords.length > 0 ? "✓ match" : "✗ no match"}
                      </span>
                      {item.pubDate && (
                        <span className="text-[10px] text-zinc-600">{item.pubDate}</span>
                      )}
                    </div>

                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-zinc-200 hover:text-cyan-400 transition line-clamp-2"
                    >
                      {item.title || <span className="text-zinc-600 italic">(empty title)</span>}
                    </a>

                    {item.snippet && (
                      <p className="mt-1 text-[11px] leading-5 text-zinc-500 line-clamp-2">{item.snippet}</p>
                    )}

                    {item.matchedKeywords.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.matchedKeywords.map((kw) => (
                          <span key={kw} className="rounded bg-cyan-400/10 px-1.5 py-0.5 text-[9px] text-cyan-400">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
