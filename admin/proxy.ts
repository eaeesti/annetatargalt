import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME } from "./lib/auth";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME);
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname.startsWith("/login");
  // Only the sign-in and logout endpoints are intentionally unauthenticated
  const isPublicApiRoute =
    pathname === "/api/login" ||
    pathname === "/api/logout" ||
    pathname === "/api/auth/google" ||
    pathname === "/api/auth/google/callback";

  if (!token && !isLoginPage && !isPublicApiRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Deliberately no "already signed in, skip the login page" redirect. A
  // cookie only shows the browser holds a token, not that Strapi still
  // accepts it, and the dashboard sends a rejected token to /login: with that
  // redirect the two bounced the browser between them forever. Signing in
  // again just replaces the cookie.
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
