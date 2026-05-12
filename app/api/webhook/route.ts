import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!process.env.N8N_SECRET || authHeader !== `Bearer ${process.env.N8N_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json();

  return NextResponse.json({
    success: true,
    receivedAt: new Date().toISOString(),
    event: payload?.event ?? "webhook.received",
  });
}
