"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AutoRefresh({ intervalMs = 20000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(intervalMs / 1000);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          router.refresh();
          return intervalMs / 1000;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [router, intervalMs]);

  return (
    <div className="flex items-center gap-2 text-[10px] text-zinc-700">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-600" />
      Auto-refresh in {countdown}s
      <button
        onClick={() => { router.refresh(); setCountdown(intervalMs / 1000); }}
        className="text-zinc-600 underline hover:text-zinc-400"
      >
        Refresh now
      </button>
    </div>
  );
}
