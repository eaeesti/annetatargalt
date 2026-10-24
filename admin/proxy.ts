import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME } from "./lib/auth";

// Dev needs two things production must never have. React's development build
// calls eval() to reconstruct callstacks, and the bundler emits eval-wrapped
// modules for source maps, so script-src needs 'unsafe-eval'; HMR talks over a
// websocket, which not every browser treats as covered by 'self'. A local
// `next build && next start` still exercises the real policy.
const isDev = process.env.NODE_ENV !== "production";

/**
 * The Content Security Policy for one response.
 *
 * - script-src: inline scripts run only with this response's nonce, which
 *   Next adds to its own and the root layout gives the theme script, so a
 *   script injected into a page doesn't run. 'strict-dynamic' lets those
 *   scripts load the page's chunks.
 * - style-src keeps 'unsafe-inline': components set style attributes, which
 *   can't carry a nonce.
 * - img-src allows https: for organization logos, which come from Strapi's
 *   media storage.
 * - connect-src 'self': the browser never calls Strapi directly; every
 *   request goes through this app's own route handlers, which forward the
 *   session cookie. So same-origin is the complete list, and it is what
 *   stops an injected script shipping donor data anywhere.
 * - form-action 'self': a form can only send to this app (sign-in with
 *   Google is a link, not a form).
 * - object-src 'none', base-uri 'self': no plugins, and no <base> tag
 *   pointing relative links elsewhere.
 * - frame-ancestors 'none': stronger clickjacking protection.
 */
function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "font-src 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

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

  // Next reads the nonce from the request's policy while it renders, and
  // the root layout reads it from x-nonce.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", policy);
  headers.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  // icon.svg is the favicon, which the sign-in page needs too
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
