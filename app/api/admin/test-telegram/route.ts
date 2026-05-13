import { NextRequest, NextResponse } from "next/server";

function isAuthed(req: NextRequest) {
  return req.cookies.get("admin_key")?.value === process.env.ADMIN_KEY;
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID;

  if (!token) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
  if (!chatId) return NextResponse.json({ error: "TELEGRAM_CHANNEL_ID not set" }, { status: 500 });

  const text = `✅ *FinCNews bot is connected*\n\nThis is a test message from the automation pipeline.\n\nChannel: ${chatId}\n🚀 Ready to publish articles.`;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({
      error: data.description ?? "Telegram API error",
      code: data.error_code,
    }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    messageId: data.result?.message_id,
    chat: data.result?.chat?.title ?? chatId,
  });
}
