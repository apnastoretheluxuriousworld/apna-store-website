import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate for /admin: no session cookie → straight to the login page.
 * This only checks that a cookie exists; the real check (valid session +
 * admin role) runs in requireAdmin() on every admin page and action.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has("apna_session");

  if (pathname !== "/admin/login" && !hasSession) {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
