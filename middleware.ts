import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isProbePath(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

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

function isProbePath(pathname: string): boolean {
  return (
    pathname.endsWith(".php") ||
    pathname.startsWith("/wp-admin") ||
    pathname.startsWith("/wp-content") ||
    pathname.startsWith("/wp-includes") ||
    pathname === "/wp-login.php" ||
    pathname === "/xmlrpc.php"
  );
}

export const config = {
  matcher: [
    "/flows",
    "/flows/:path*",
    "/wp-admin/:path*",
    "/wp-content/:path*",
    "/wp-includes/:path*",
    "/wp-login.php",
    "/xmlrpc.php",
    "/:path*.php",
  ],
};
