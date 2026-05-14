"use client";

import { useState, useEffect } from "react";
import type { PipelineConfig } from "@/lib/pipeline-config";

type CronDef = {
  key: "collect" | "generate";
  label: string;
  schedule: string;
  scheduleHuman: string;
  maxDuration: string;
  endpoint: string;
  enabledKey: keyof PipelineConfig;
};

const CRONS: CronDef[] = [
  {
    key: "collect",
    label: "Collect",
    schedule: "*/30 * * * *",
    scheduleHuman: "Every 30 min",
    maxDuration: "30s",
    endpoint: "/api/cron/collect",
    enabledKey: "collect_enabled",
  },
  {
    key: "generate",
    label: "Generate",
    schedule: "0 * * * *",
    scheduleHuman: "Every hour",
    maxDuration: "120s",
    endpoint: "/api/cron/generate",
    enabledKey: "generate_enabled",
  },
];

export default function CronControl() {
  const [config, setConfig] = useState<PipelineConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/pipeline-config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => null);
  }, []);

  async function patch(updates: Partial<Record<keyof PipelineConfig, string>>) {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/pipeline-config", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updates),
      });
      const next = await res.json() as PipelineConfig;
      setConfig(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return <div className="py-6 text-center text-xs text-zinc-600">Loading config…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Cron cards */}
      {CRONS.map((cron) => {
        const enabled = config[cron.enabledKey] as boolean;
        return (
          <div
            key={cron.key}
            className={`rounded-xl border p-5 transition ${
              enabled ? "border-white/[0.08] bg-zinc-900/40" : "border-white/[0.04] bg-zinc-950/60 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${enabled ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                  <p className="text-sm font-bold text-zinc-200">{cron.label}</p>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                    enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-700 text-zinc-500"
                  }`}>{enabled ? "running" : "paused"}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-600">
                  <span>Schedule: <code className="text-zinc-400">{cron.schedule}</code> · {cron.scheduleHuman}</span>
                  <span>maxDuration: <span className="text-zinc-400">{cron.maxDuration}</span></span>
                  <span>Endpoint: <code className="text-zinc-400">{cron.endpoint}</code></span>
                </div>
              </div>

              {/* Toggle */}
              <button
                onClick={() => patch({ [cron.enabledKey]: String(!enabled) })}
                disabled={saving}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
                  enabled ? "bg-emerald-500" : "bg-zinc-700"
                }`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-5" : "translate-x-0.5"
                }`} />
              </button>
            </div>
          </div>
        );
      })}

      {/* Global settings */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/30 p-5">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Pipeline Parameters</p>
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Max articles per generate run */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-400">
              Max articles per generate run
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={config.generate_max_per_run}
                onChange={(e) => setConfig((c) => c ? { ...c, generate_max_per_run: Number(e.target.value) } : c)}
                onMouseUp={(e) => patch({ generate_max_per_run: (e.target as HTMLInputElement).value })}
                onTouchEnd={(e) => patch({ generate_max_per_run: (e.target as HTMLInputElement).value })}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-cyan-400"
              />
              <span className="w-4 text-right text-sm font-bold tabular-nums text-zinc-200">
                {config.generate_max_per_run}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-zinc-600">
              {config.generate_max_per_run === 1 ? "1 article · ~30s" :
               config.generate_max_per_run <= 2 ? `${config.generate_max_per_run} articles · ~60s` :
               `${config.generate_max_per_run} articles · ~${config.generate_max_per_run * 30}s`}
            </p>
          </div>

          {/* Min hype score */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-400">
              Min hype score (queue filter)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={80}
                step={5}
                value={config.min_score}
                onChange={(e) => setConfig((c) => c ? { ...c, min_score: Number(e.target.value) } : c)}
                onMouseUp={(e) => patch({ min_score: (e.target as HTMLInputElement).value })}
                onTouchEnd={(e) => patch({ min_score: (e.target as HTMLInputElement).value })}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-cyan-400"
              />
              <span className={`w-6 text-right text-sm font-bold tabular-nums ${
                config.min_score >= 60 ? "text-emerald-400" : config.min_score >= 40 ? "text-cyan-400" : "text-amber-400"
              }`}>
                {config.min_score}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-zinc-600">
              {config.min_score <= 20 ? "Very permissive — almost everything queued" :
               config.min_score <= 40 ? "Permissive — most articles pass" :
               config.min_score <= 55 ? "Balanced — typical breaking news" :
               "Strict — only high-signal articles"}
            </p>
          </div>
        </div>
      </div>

      {/* Save indicator */}
      {(saving || saved) && (
        <p className={`text-right text-[11px] transition ${saved ? "text-emerald-400" : "text-zinc-600"}`}>
          {saved ? "✓ Saved" : "Saving…"}
        </p>
      )}
    </div>
  );
}
