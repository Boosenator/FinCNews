"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") ?? "/flows";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (res.ok) {
      router.push(from);
    } else {
      setError("Invalid admin key");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-2xl font-black text-white">
            Fin<span className="text-cyan-400">C</span>News
          </span>
          <p className="mt-2 text-sm text-zinc-500">Admin Panel</p>
        </div>
        <form onSubmit={submit} className="rounded-xl border border-white/[0.08] bg-zinc-900/60 p-6">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Admin Key
          </label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Enter ADMIN_KEY"
            className="w-full rounded-lg border border-white/[0.08] bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-cyan-400/50"
            autoFocus
          />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-cyan-400 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
