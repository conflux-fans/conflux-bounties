import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-constants";

const LOGIN = "/login";

/**
 * Edge-safe gate: ensures session cookie exists before hitting protected routes.
 * Full JWT + DB validation happens in server layouts via getSession().
 */
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (
    !path.startsWith("/members") &&
    !path.startsWith("/resources") &&
    !path.startsWith("/admin") &&
    !path.startsWith("/profile")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    const url = new URL(LOGIN, req.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", path);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/members/:path*",
    "/resources/:path*",
    "/admin/:path*",
    "/profile",
    "/profile/:path*",
  ],
};
