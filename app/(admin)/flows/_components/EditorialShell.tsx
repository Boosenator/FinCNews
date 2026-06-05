"use client";

import { useState } from "react";
import PersonasTab from "./PersonasTab";
import ContentPlanTab from "./ContentPlanTab";

const TABS = [
  { key: "personas", label: "Personas", badge: "AI" },
  { key: "content",  label: "Content Plan" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default function EditorialShell() {
  const [tab, setTab] = useState<Tab>("personas");

  return (
    <div>
      {/* Sub-nav */}
      <div className="sticky top-[53px] z-40 border-b border-white/[0.04] bg-zinc-950/97 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl gap-1 px-4 py-1 sm:px-6">
          {TABS.map(({ key, label, ...rest }) => {
            const badge = "badge" in rest ? rest.badge : undefined;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  tab === key ? "bg-white/[0.07] text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {label}
                {badge && (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-400">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {tab === "personas" && <PersonasTab />}
        {tab === "content"  && <ContentPlanTab />}
      </div>
    </div>
  );
}
