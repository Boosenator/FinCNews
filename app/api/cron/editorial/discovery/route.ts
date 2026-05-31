import { NextRequest, NextResponse } from "next/server";
import { runTopicDiscoveryAgent } from "@/lib/editorial-agent";

export const maxDuration = 60;

function isAuthed(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runTopicDiscoveryAgent();
  return NextResponse.json({ ok: true, ...result });
}

export const POST = GET;
