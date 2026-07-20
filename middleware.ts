import { NextRequest, NextResponse } from "next/server";
import { isProductionHost } from "@/lib/seo-host";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isProbePath(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  if (!pathname.startsWith("/flows")) return withPreviewNoindex(req, NextResponse.next());
  if (pathname === "/flows/login") return withPreviewNoindex(req, NextResponse.next());

  const cookie = req.cookies.get("admin_key")?.value;
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey || cookie !== adminKey) {
    const login = req.nextUrl.clone();
    login.pathname = "/flows/login";
    login.searchParams.set("from", pathname);
    return withPreviewNoindex(req, NextResponse.redirect(login));
  }

  return withPreviewNoindex(req, NextResponse.next());
}

function withPreviewNoindex(req: NextRequest, res: NextResponse): NextResponse {
  if (!isProductionHost(req.headers.get("host"))) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
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
    "/((?!_next/static|_next/image|favicon.ico|icon.jpg).*)",
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
