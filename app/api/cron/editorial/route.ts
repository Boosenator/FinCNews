import { NextRequest, NextResponse } from "next/server";
import { runEditorialAgent, runScheduledEditorialAgent } from "@/lib/editorial-agent";

export const maxDuration = 60;

function isAuthed(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
}

async function handle(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const slot = url.searchParams.get("slot");
  if (slot === "morning" || slot === "evening") {
    const result = await runScheduledEditorialAgent(slot);
    return NextResponse.json({ ok: true, ...result });
  }

  const slug = url.searchParams.get("slug") ?? undefined;
  const result = await runEditorialAgent(slug);
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
