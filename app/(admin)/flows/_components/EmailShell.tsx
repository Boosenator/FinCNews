"use client";

import { useState } from "react";
import EmailCampaignsTab from "./EmailCampaignsTab";
import EmailTab from "./EmailTab";

const TABS = [
  { key: "campaigns",    label: "Campaigns" },
  { key: "subscribers",  label: "Subscribers & Logs" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default function EmailShell() {
  const [tab, setTab] = useState<Tab>("campaigns");

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
        {tab === "campaigns"   && <EmailCampaignsTab />}
        {tab === "subscribers" && <EmailTab />}
      </div>
    </div>
  );
}
