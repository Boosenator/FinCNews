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

      if (!res.ok) {
        setStatus("error");
        return;
      }

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

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-zinc-950/95 px-4 py-4 backdrop-blur-md sm:px-6"
      role="complementary"
      aria-label="Newsletter subscription"
    >
      <div className="mx-auto flex max-w-4xl items-center gap-4">
        {/* Text */}
        <div className="hidden min-w-0 flex-1 sm:block">
          {sent || duplicate ? (
            <p className="text-sm font-medium text-cyan-400">
              {sent ? "Check your inbox to confirm." : "You're already subscribed."}
            </p>
          ) : (
            <>
              <p className="truncate text-sm font-semibold text-zinc-200">
                Get breaking finance news
              </p>
              <p className="text-xs text-zinc-600">
                Crypto · Markets · Macro — straight to your inbox
              </p>
            </>
          )}
        </div>

        {/* Mobile headline when not sent */}
        {!sent && !duplicate && (
          <div className="min-w-0 flex-1 sm:hidden">
            <p className="truncate text-sm font-semibold text-zinc-200">Get breaking finance news</p>
          </div>
        )}

        {/* Form */}
        {!sent && !duplicate && (
          <form onSubmit={submit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              disabled={status === "loading"}
              className="h-9 w-44 rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20 disabled:opacity-50 sm:w-56"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="h-9 whitespace-nowrap rounded-md bg-cyan-400 px-4 text-sm font-semibold text-black transition hover:bg-cyan-300 disabled:opacity-60"
            >
              {status === "loading" ? "..." : "Subscribe"}
            </button>
          </form>
        )}

        {/* Sent / duplicate state on mobile */}
        {(sent || duplicate) && (
          <p className="flex-1 text-sm font-medium text-cyan-400 sm:hidden">
            {sent ? "Check your inbox to confirm." : "Already subscribed."}
          </p>
        )}

        {/* Dismiss */}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 text-zinc-600 transition hover:text-zinc-400"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {/* Error message */}
      {status === "error" && (
        <p className="mt-2 text-center text-xs text-red-400">
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  );
}
