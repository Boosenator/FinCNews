"use client";

import { useState } from "react";

type Result = {
  id: string;
  title: string;
  status: "ok" | "error";
  error?: string;
};

type Response = {
  found: number;
  attached: number;
  errors: number;
  results: Result[];
  error?: string;
};

export default function AttachImagesButton() {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [data, setData] = useState<Response | null>(null);
  const [open, setOpen] = useState(false);

  async function run() {
    setState("running");
    setData(null);
    try {
      const res = await fetch("/api/admin/attach-images", { method: "POST" });
      const json = await res.json();
      setData(json);
      setOpen(true);
    } catch (e) {
      setData({ found: 0, attached: 0, errors: 1, results: [], error: String(e) });
      setOpen(true);
    }
    setState("done");
    setTimeout(() => setState("idle"), 5000);
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={state === "running"}
        className="flex items-center gap-2 rounded-lg border border-white/[0.12] px-3.5 py-2 text-sm font-semibold text-zinc-300 transition hover:border-amber-400/40 hover:text-amber-300 disabled:cursor-wait disabled:opacity-40"
      >
        {state === "running" ? (
          <>
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Attaching...
          </>
        ) : (
          <>📷 Attach Images</>
        )}
      </button>

      {/* Result modal */}
      {open && data && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/80 pt-16 backdrop-blur-sm px-4">
          <div className="w-full max-w-xl rounded-xl border border-white/[0.08] bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div>
                <p className="text-sm font-bold text-white">Attach Images</p>
                {!data.error && (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Found {data.found} without image →{" "}
                    <span className="text-emerald-400">{data.attached} attached</span>
                    {data.errors > 0 && (
                      <span className="text-red-400"> · {data.errors} errors</span>
                    )}
                  </p>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Close
              </button>
            </div>

            {data.error ? (
              <p className="p-5 text-sm text-red-400">{data.error}</p>
            ) : data.found === 0 ? (
              <p className="p-5 text-center text-sm text-zinc-500">
                All articles already have images ✓
              </p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-white/[0.04]">
                {data.results.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 px-5 py-3">
                    <span className={`mt-0.5 shrink-0 text-[10px] font-bold uppercase ${r.status === "ok" ? "text-emerald-400" : "text-red-400"}`}>
                      {r.status === "ok" ? "✓" : "✗"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs text-zinc-300">{r.title}</p>
                      {r.error && <p className="text-[10px] text-red-400">{r.error}</p>}
                    </div>
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
