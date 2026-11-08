import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gates: no session cookie → straight to the right sign-in page.
 * This only checks that a cookie exists; the real checks run on every page
 * and action (requireAdmin() for /admin, requireCustomer() for /account).
 */
const PUBLIC_ACCOUNT_PAGES = new Set(["/account/login", "/account/signup"]);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has("apna_session");
  if (hasSession) return NextResponse.next();

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/account") && !PUBLIC_ACCOUNT_PAGES.has(pathname)) {
    const url = new URL("/account/login", request.url);
    if (pathname !== "/account") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/account", "/account/:path*"],
};
