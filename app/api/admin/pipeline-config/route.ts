import { NextRequest, NextResponse } from "next/server";
import { getPipelineConfig, setPipelineConfig, type PipelineConfig } from "@/lib/pipeline-config";

function isAuthed(req: NextRequest) {
  return req.cookies.get("admin_key")?.value === process.env.ADMIN_KEY;
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const config = await getPipelineConfig();
  return NextResponse.json(config);
}

export async function PATCH(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Partial<Record<keyof PipelineConfig, string>>;
  const allowed: Array<keyof PipelineConfig> = ["collect_enabled", "generate_enabled", "generate_max_per_run", "min_score"];
  const updates: Partial<Record<keyof PipelineConfig, string>> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = String(body[key]);
  }

  await setPipelineConfig(updates);
  return NextResponse.json(await getPipelineConfig());
}
