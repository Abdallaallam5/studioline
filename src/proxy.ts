import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

/**
 * Optimistic redirect for signed-out visitors, so they skip a server render
 * before being sent to the login page. This is a convenience only: the cookie
 * is not verified here. Real authentication and authorization happen in the
 * guards (src/server/context.ts) on every page and server action.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/owner/:path*", "/workspace/:path*", "/my/:path*"],
};
