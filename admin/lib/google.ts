import type { NextRequest } from "next/server";

/** Google sign-in settings; null when this deployment doesn't offer it. */
export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  // Only a hint to Google's account picker. The backend is what checks the
  // domain, against the signed token.
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN;
  return { clientId, clientSecret, domain };
}

/** Holds state, nonce and PKCE verifier between the two Google redirects. */
export const GOOGLE_FLOW_COOKIE = "google-sign-in";
export const GOOGLE_FLOW_PATH = "/api/auth/google";

/**
 * The panel's address as the browser sees it. A route handler's own URL can't
 * be used: under `next start` it always says localhost, and Google needs the
 * redirect address to match the registered one exactly. Trusting these headers
 * is safe here, since Google only sends a user to an address registered for
 * this client, so a spoofed host only breaks that request.
 */
export function requestOrigin(request: NextRequest) {
  const host = (
    request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  )
    ?.split(",")[0]
    ?.trim();
  if (!host) return request.nextUrl.origin;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export function googleRedirectUri(request: NextRequest) {
  return `${requestOrigin(request)}${GOOGLE_FLOW_PATH}/callback`;
}

// The login page shows these by code. Messages are never taken from the URL,
// so a crafted link can't put words on the login page.
export const GOOGLE_ERRORS = {
  "google-cancelled": "Google sign-in was cancelled.",
  "google-failed": "Google sign-in failed. Try again.",
  "wrong-domain": "Sign in with your organisation's Google account.",
  "no-access": "This Google account doesn't have access to the admin panel.",
} as const;

export type GoogleErrorCode = keyof typeof GOOGLE_ERRORS;

export function isGoogleErrorCode(code: unknown): code is GoogleErrorCode {
  // hasOwn, not `in`: `in` also accepts inherited names like "__proto__"
  return typeof code === "string" && Object.hasOwn(GOOGLE_ERRORS, code);
}
