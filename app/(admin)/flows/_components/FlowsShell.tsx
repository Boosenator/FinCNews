"use client";

import { useState } from "react";
import type { RssSource, RunLog } from "@/lib/supabase";
import LogsTab from "./LogsTab";
import AnalyticsTab from "./AnalyticsTab";
import SettingsTab from "./SettingsTab";
import QueueTab from "./QueueTab";
import ContentPlanTab from "./ContentPlanTab";

type Props = {
  sources: RssSource[];
  logs: RunLog[];
  totalProcessed: number;
  queuePending: number;
  queueTotal: number;
  stats: {
    lastRun: RunLog | null;
    todayPublished: number;
    activeSources: number;
  };
};

const TABS = [
  { key: "logs", label: "Flow Logs", icon: "Run" },
  { key: "queue", label: "Queue", icon: "Q" },
  { key: "content", label: "Content Plan", icon: "CP" },
  { key: "analytics", label: "Analytics", icon: "A" },
  { key: "settings", label: "Settings", icon: "S" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default function FlowsShell({ sources, logs, totalProcessed, queuePending, queueTotal, stats }: Props) {
  const [tab, setTab] = useState<Tab>("logs");

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="sticky top-0 z-30 border-b border-white/[0.06] bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto py-1">
            {TABS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  tab === key
                    ? "bg-white/[0.07] text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span className="text-[11px] font-black">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {tab === "logs" && (
          <LogsTab
            logs={logs}
            queuePending={queuePending}
            queueTotal={queueTotal}
            stats={stats}
            totalProcessed={totalProcessed}
          />
        )}
        {tab === "queue" && <QueueTab />}
        {tab === "content" && <ContentPlanTab />}
        {tab === "analytics" && <AnalyticsTab sources={sources} logs={logs} />}
        {tab === "settings" && <SettingsTab sources={sources} />}
      </div>
    </div>
  );
}
