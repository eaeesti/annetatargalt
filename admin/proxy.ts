import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME } from "./lib/auth";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME);
  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");

  if (!token && !isLoginPage && !isApiRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
