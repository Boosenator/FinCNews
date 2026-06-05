"use client";

import { useState } from "react";
import type { RunLog, RssSource } from "@/lib/supabase";
import DashboardOverview from "./DashboardOverview";
import LogsTab from "./LogsTab";
import QueueTab from "./QueueTab";
import AnalyticsTab from "./AnalyticsTab";

interface QueueItem {
  id: string;
  score: number | null;
  title?: string | null;
  source_url?: string | null;
  status: string;
  created_at: string;
}

interface ElenaRun {
  should_write: boolean;
  score: number;
  reasoning: string;
  topic: string | null;
  article_slug: string | null;
  created_at: string;
}

type Props = {
  sources:        RssSource[];
  logs:           RunLog[];
  totalProcessed: number;
  queuePending:   number;
  queueTotal:     number;
  recentQueue:    QueueItem[];
  elenaLastRun:   ElenaRun | null;
  stats: {
    lastRun:         RunLog | null;
    todayPublished:  number;
    activeSources:   number;
  };
};

const TABS = [
  { key: "overview",   label: "Overview" },
  { key: "queue",      label: "Queue" },
  { key: "logs",       label: "Run Logs" },
  { key: "analytics",  label: "Analytics" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default function DashboardShell({
  sources, logs, totalProcessed, queuePending, queueTotal,
  recentQueue, elenaLastRun, stats,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div>
      {/* Sub-nav */}
      <div className="sticky top-[53px] z-40 border-b border-white/[0.04] bg-zinc-950/97 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl gap-1 px-4 py-1 sm:px-6">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                tab === key ? "bg-white/[0.07] text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {tab === "overview" && (
          <DashboardOverview
            logs={logs}
            queuePending={queuePending}
            queueTotal={queueTotal}
            activeSources={stats.activeSources}
            totalProcessed={totalProcessed}
            todayPublished={stats.todayPublished}
            lastRun={stats.lastRun}
            recentQueue={recentQueue}
            elenaLastRun={elenaLastRun}
          />
        )}
        {tab === "queue"     && <QueueTab />}
        {tab === "logs"      && (
          <LogsTab
            logs={logs}
            queuePending={queuePending}
            queueTotal={queueTotal}
            stats={stats}
            totalProcessed={totalProcessed}
          />
        )}
        {tab === "analytics" && <AnalyticsTab />}
      </div>
    </div>
  );
}
