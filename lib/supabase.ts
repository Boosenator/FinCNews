import { createClient } from "@supabase/supabase-js";

// Server-side admin client — lazy, never call at module level
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type RssSource = {
  id: string;
  name: string;
  url: string;
  category: string;
  enabled: boolean;
  last_fetched_at: string | null;
  articles_published: number;
  created_at: string;
};

export type RunLogDetail = {
  url: string;
  slug?: string;
  title?: string;
  category?: string;
  excerpt?: string;
  bodyPreview?: string;
  imageAttached?: boolean;
  status: string;
  error?: string;
};

export type PipelineStep = {
  name: string;
  status: "ok" | "error" | "fallback" | "skip";
  durationMs: number;
  in: number;
  out: number;
  note?: string;
  // collect-specific
  perSource?: Array<{ name: string; category: string; count: number; error?: boolean }>;
  scoredItems?: Array<{ title: string; score: number }>;
  scoreDistribution?: { below45: number; s45_60: number; s60_80: number; above80: number };
  dedupBreakdown?: { urlDuped: number; belowScore: number; semanticDuped: number };
  // generate-specific
  articleSteps?: Array<{
    name: string;
    status: "ok" | "error" | "skip";
    durationMs: number;
    note?: string;
  }>;
};

export type RunLog = {
  id: string;
  started_at: string;
  finished_at: string | null;
  run_type: "collect" | "generate";
  status: "running" | "success" | "error" | "partial";
  articles_found: number;
  articles_published: number;
  articles_skipped: number;
  duration_ms: number | null;
  error_text: string | null;
  details: RunLogDetail[];
  steps: PipelineStep[] | null;
};
