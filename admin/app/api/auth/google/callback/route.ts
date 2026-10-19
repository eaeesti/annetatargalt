import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  GOOGLE_FLOW_COOKIE,
  GOOGLE_FLOW_PATH,
  googleConfig,
  googleRedirectUri,
  requestOrigin,
} from "../../../../../lib/google";
import type { GoogleErrorCode } from "../../../../../lib/google";
import { setSessionCookie } from "../../../../../lib/session";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";

interface Flow {
  state: string;
  nonce: string;
  verifier: string;
}

function readFlow(raw: string | undefined): Flow | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" &&
      value !== null &&
      "state" in value &&
      "nonce" in value &&
      "verifier" in value &&
      typeof value.state === "string" &&
      typeof value.nonce === "string" &&
      typeof value.verifier === "string"
    ) {
      return {
        state: value.state,
        nonce: value.nonce,
        verifier: value.verifier,
      };
    }
  } catch {
    // Not ours, or tampered with: treat as missing.
  }
  return null;
}

function stringField(body: unknown, key: string): string | undefined {
  if (typeof body !== "object" || body === null || !(key in body)) return;
  const value: unknown = Reflect.get(body, key);
  return typeof value === "string" ? value : undefined;
}

/** The reason code the backend attaches to a refused Google sign-in. */
async function refusalReason(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    const error =
      typeof body === "object" && body !== null && "error" in body
        ? body.error
        : null;
    const details =
      typeof error === "object" && error !== null && "details" in error
        ? error.details
        : null;
    return stringField(details, "reason");
  } catch {
    return undefined;
  }
}

/**
 * Where Google sends the browser back: swaps the code for an ID token, and
 * lets the backend decide whether its owner gets in.
 */
export async function GET(request: NextRequest) {
  const fail = (code: GoogleErrorCode) => {
    const response = NextResponse.redirect(
      new URL(`/login?error=${code}`, requestOrigin(request)),
    );
    response.cookies.delete({
      name: GOOGLE_FLOW_COOKIE,
      path: GOOGLE_FLOW_PATH,
    });
    return response;
  };

  const config = googleConfig();
  if (!config) return fail("google-failed");

  const params = request.nextUrl.searchParams;
  const googleError = params.get("error");
  if (googleError) {
    return fail(
      googleError === "access_denied" ? "google-cancelled" : "google-failed",
    );
  }

  const flow = readFlow(request.cookies.get(GOOGLE_FLOW_COOKIE)?.value);
  const code = params.get("code");
  if (!flow || !code || params.get("state") !== flow.state) {
    return fail("google-failed");
  }

  let idToken: string | undefined;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: googleRedirectUri(request),
        grant_type: "authorization_code",
        code_verifier: flow.verifier,
      }),
    });
    if (tokenRes.ok) idToken = stringField(await tokenRes.json(), "id_token");
  } catch {
    // Handled below, as a missing token.
  }
  if (!idToken) return fail("google-failed");

  let strapiRes: Response;
  try {
    strapiRes = await fetch(`${STRAPI_URL}/api/admin-auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, nonce: flow.nonce }),
    });
  } catch {
    return fail("google-failed");
  }

  if (!strapiRes.ok) {
    if (strapiRes.status === 403) return fail("no-access");
    const reason = await refusalReason(strapiRes);
    return fail(reason === "wrong-domain" ? "wrong-domain" : "google-failed");
  }

  const jwt = stringField(await strapiRes.json(), "jwt");
  if (!jwt) return fail("google-failed");

  // A page that moves on by itself, rather than a redirect. The session
  // cookie is SameSite=Strict, and a redirect here would still count as part
  // of the navigation that came from Google's site, so the browser would
  // leave the cookie off and the panel would send the user back to login.
  // The page's own navigation starts on this site, so the cookie goes along.
  const response = new NextResponse(
    '<!doctype html><meta http-equiv="refresh" content="0;url=/"><title>Signing in…</title>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
  setSessionCookie(response, jwt);
  response.cookies.delete({ name: GOOGLE_FLOW_COOKIE, path: GOOGLE_FLOW_PATH });
  return response;
}
