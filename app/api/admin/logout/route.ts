import { NextResponse } from "next/server";

export async function GET() {
  const res = NextResponse.redirect(new URL("/flows/login", process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"));
  res.cookies.delete("admin_key");
  return res;
}
