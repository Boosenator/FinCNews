import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/flows")) return NextResponse.next();
  if (pathname === "/flows/login") return NextResponse.next();

  const cookie = req.cookies.get("admin_key")?.value;
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey || cookie !== adminKey) {
    const login = req.nextUrl.clone();
    login.pathname = "/flows/login";
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/flows", "/flows/:path*"],
};
