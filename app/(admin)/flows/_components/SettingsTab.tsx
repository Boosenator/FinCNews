"use client";

import type { RssSource } from "@/lib/supabase";
import ToggleSource from "./ToggleSource";
import AddSourceForm from "./AddSourceForm";
import TestSourceButton from "./TestSourceButton";
import TelegramTestButton from "./TelegramTestButton";
import CronControl from "./CronControl";

type Props = {
  sources: RssSource[];
};

export default function SettingsTab({ sources }: Props) {
  const enabled = sources.filter((s) => s.enabled);
  const disabled = sources.filter((s) => !s.enabled);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-black text-white">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          RSS sources, cron schedule, and integration config
        </p>
      </div>

      {/* Sources */}
      <section>
        <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
          RSS Sources
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
            {enabled.length} active · {disabled.length} off
          </span>
        </h2>

        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-zinc-900/60">
                {["Source", "Category", "URL", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {sources.map((src) => (
                <tr key={src.id} className={`transition hover:bg-white/[0.02] ${!src.enabled ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-zinc-200">{src.name}</p>
                      <TestSourceButton id={src.id} name={src.name} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
                      {src.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[260px]">
                    <p className="truncate text-[10px] text-zinc-600">
                      {src.url.replace(/^https?:\/\//, "")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <ToggleSource id={src.id} enabled={src.enabled} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <AddSourceForm />
        </div>
      </section>

      {/* Pipeline config */}
      <section>
        <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
          Pipeline Config
        </h2>
        <CronControl />
      </section>

      {/* External cron */}
      <section>
        <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
          External Cron (Backup)
        </h2>
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/30 p-5 space-y-3">
          <p className="text-xs text-zinc-500">
            Backup trigger via{" "}
            <a href="https://cron-job.org" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
              cron-job.org
            </a>
          </p>
          <code className="block break-all rounded bg-zinc-800 px-3 py-2 text-[11px] text-zinc-300">
            POST {process.env.NEXT_PUBLIC_BASE_URL}/api/cron
          </code>
          <p className="text-[10px] text-zinc-600">
            Header:{" "}
            <span className="text-zinc-400">Authorization: Bearer {"{CRON_SECRET}"}</span>
          </p>
        </div>
      </section>

      {/* Telegram */}
      <section>
        <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
          Telegram Integration
        </h2>
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/30 p-5">
          <p className="mb-4 text-xs text-zinc-500">
            Send a test message to verify the bot and channel are configured correctly.
          </p>
          <TelegramTestButton />
        </div>
      </section>
    </div>
  );
}
