import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  GOOGLE_FLOW_COOKIE,
  GOOGLE_FLOW_PATH,
  googleConfig,
  googleRedirectUri,
  requestOrigin,
} from "../../../../lib/google";

/** Starts a Google sign-in: sends the browser to Google's account picker. */
export function GET(request: NextRequest) {
  const config = googleConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/login", requestOrigin(request)));
  }

  // state ties Google's answer to this browser, nonce ties the ID token to
  // this sign-in, and the PKCE verifier makes the code useless to anyone who
  // intercepts it without the cookie.
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: googleRedirectUri(request),
    response_type: "code",
    scope: "openid email",
    state,
    nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
    ...(config.domain ? { hd: config.domain } : {}),
  }).toString();

  const response = NextResponse.redirect(url);
  response.cookies.set(
    GOOGLE_FLOW_COOKIE,
    JSON.stringify({ state, nonce, verifier }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // Not strict: Google sends the browser back with a top-level navigation
      // from its own site, and a strict cookie wouldn't come along.
      sameSite: "lax",
      maxAge: 10 * 60,
      path: GOOGLE_FLOW_PATH,
    },
  );
  return response;
}
