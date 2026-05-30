import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { runEditorialAgent, TOPIC_HUB_PLANS } from "@/lib/editorial-agent";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ topics: TOPIC_HUB_PLANS });
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { slug?: string };
  const result = await runEditorialAgent(body.slug);
  return NextResponse.json({ ok: true, ...result });
}
