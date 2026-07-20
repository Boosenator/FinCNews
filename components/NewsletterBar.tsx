"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "loading" | "sent" | "error" | "duplicate";

const LS_KEY = "fincnews-nl-v1";

export default function NewsletterBar() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (localStorage.getItem(LS_KEY)) return;
    const t = setTimeout(() => setVisible(true), 2800);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    localStorage.setItem(LS_KEY, "1");
    setVisible(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === "loading") return;
    setStatus("loading");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();

      if (!res.ok) { setStatus("error"); return; }

      if (body.message === "already_subscribed") {
        setStatus("duplicate");
      } else {
        setStatus("sent");
        setTimeout(dismiss, 4000);
      }
    } catch {
      setStatus("error");
    }
  };

  if (!visible) return null;

  const sent = status === "sent";
  const duplicate = status === "duplicate";
  const done = sent || duplicate;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-zinc-950/95 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4"
      role="complementary"
      aria-label="Newsletter subscription"
    >
      <div className="mx-auto max-w-4xl">

        {/* ── Success / duplicate state ── */}
        {done && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-cyan-400">
              {sent ? "Check your inbox to confirm your subscription." : "You're already subscribed."}
            </p>
            <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-zinc-600 hover:text-zinc-400">
              <XIcon />
            </button>
          </div>
        )}

        {/* ── Default state ── */}
        {!done && (
          <>
            {/* Row 1: headline + dismiss */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-200">Get breaking finance news</p>
                <p className="hidden text-xs text-zinc-600 sm:block">
                  Crypto · Markets · Macro — straight to your inbox
                </p>
              </div>
              <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-zinc-600 hover:text-zinc-400">
                <XIcon />
              </button>
            </div>

            {/* Row 2: form */}
            <form onSubmit={submit} className="mt-2.5 flex items-center gap-2">
              <input
                ref={inputRef}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={status === "loading"}
                className="h-9 min-w-0 flex-1 rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="h-9 shrink-0 rounded-md bg-cyan-400 px-4 text-sm font-semibold text-black transition hover:bg-cyan-300 disabled:opacity-60"
              >
                {status === "loading" ? "…" : "Subscribe"}
              </button>
            </form>

            {status === "error" && (
              <p className="mt-1.5 text-xs text-red-400">Something went wrong. Please try again.</p>
            )}
          </>
        )}

      </div>
    </div>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}
