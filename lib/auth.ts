import type { NextRequest } from "next/server";

export function isAuthed(req: NextRequest): boolean {
  return req.cookies.get("admin_key")?.value === process.env.ADMIN_KEY;
}

export function isAuthedOrN8n(req: NextRequest): boolean {
  if (isAuthed(req)) return true;
  const secret = process.env.N8N_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization");
  return bearer === `Bearer ${secret}`;
}
