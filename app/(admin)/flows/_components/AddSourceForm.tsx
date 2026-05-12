"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = ["crypto", "markets", "economy", "fintech", "policy", "companies"];

export default function AddSourceForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("crypto");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/admin/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url, category }),
    });
    setSaving(false);
    setOpen(false);
    setName("");
    setUrl("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-dashed border-white/[0.12] px-4 py-2 text-xs text-zinc-500 transition hover:border-cyan-400/40 hover:text-cyan-400"
      >
        + Add source
      </button>
    );
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.08] bg-zinc-900/60 p-4">
      <div className="flex-1 min-w-[140px]">
        <label className="mb-1 block text-[10px] uppercase tracking-widest text-zinc-600">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="CoinDesk"
          className="w-full rounded-lg border border-white/[0.08] bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50" />
      </div>
      <div className="flex-[2] min-w-[200px]">
        <label className="mb-1 block text-[10px] uppercase tracking-widest text-zinc-600">RSS URL</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} required type="url" placeholder="https://..."
          className="w-full rounded-lg border border-white/[0.08] bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50" />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-widest text-zinc-600">Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50">
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-cyan-300 disabled:opacity-50">
          {saving ? "Saving..." : "Add"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-zinc-400 hover:text-white">
          Cancel
        </button>
      </div>
    </form>
  );
}
