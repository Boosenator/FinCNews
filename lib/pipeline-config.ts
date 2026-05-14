import { supabaseAdmin } from "@/lib/supabase";

export type PipelineConfig = {
  collect_enabled: boolean;
  generate_enabled: boolean;
  generate_max_per_run: number;
  min_score: number;
};

export const CONFIG_DEFAULTS: PipelineConfig = {
  collect_enabled: true,
  generate_enabled: true,
  generate_max_per_run: 1,
  min_score: 45,
};

export async function getPipelineConfig(): Promise<PipelineConfig> {
  const db = supabaseAdmin();
  const { data } = await db.from("pipeline_config").select("key, value");
  if (!data?.length) return CONFIG_DEFAULTS;
  const map = Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]));
  return {
    collect_enabled:      map.collect_enabled !== "false",
    generate_enabled:     map.generate_enabled !== "false",
    generate_max_per_run: Math.max(1, Math.min(5, parseInt(map.generate_max_per_run ?? "1") || 1)),
    min_score:            Math.max(0, Math.min(100, parseInt(map.min_score ?? "45") || 45)),
  };
}

export async function setPipelineConfig(updates: Partial<Record<keyof PipelineConfig, string>>): Promise<void> {
  const db = supabaseAdmin();
  const rows = Object.entries(updates).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
  }));
  await db.from("pipeline_config").upsert(rows, { onConflict: "key" });
}
