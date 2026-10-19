import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTVerifyGetKey } from "jose";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

// jose fetches these lazily, caches them, and refetches when it meets a key
// id it doesn't know, which is how Google's key rotation shows up.
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export interface GoogleIdTokenExpectations {
  /** The OAuth client the token must have been issued to. */
  clientId: string;
  /** The Google Workspace domain the account must belong to. */
  domain: string;
  /** The nonce the sign-in that produced this token was started with. */
  nonce: string;
}

export type GoogleIdTokenResult =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" | "wrong-domain" | "unverified-email" };

/**
 * Checks a Google ID token and returns the account's email if it belongs to
 * the given Workspace domain.
 *
 * Both the `hd` claim and the address itself must name the domain. `hd` is
 * what makes this a Workspace check at all: a personal Google account can
 * carry any address, but only the Workspace that owns a domain can put that
 * domain in `hd`. The address check then keeps out the Workspace's other
 * domains, if it ever has any. The `hd` parameter on the sign-in link is only
 * a hint to Google's account picker, and anyone can remove it from the URL,
 * so it proves nothing on its own.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  { clientId, domain, nonce }: GoogleIdTokenExpectations,
  keys: JWTVerifyGetKey = googleKeys,
): Promise<GoogleIdTokenResult> {
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, keys, {
      issuer: GOOGLE_ISSUERS,
      audience: clientId,
      algorithms: ["RS256"],
    }));
  } catch {
    return { ok: false, reason: "invalid" };
  }

  // The nonce ties the token to the browser that started this sign-in, so a
  // token obtained elsewhere can't be replayed here.
  if (!nonce || payload.nonce !== nonce)
    return { ok: false, reason: "invalid" };

  const expectedDomain = domain.toLowerCase();
  const email =
    typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  const hd = typeof payload.hd === "string" ? payload.hd.toLowerCase() : "";
  if (hd !== expectedDomain || !email.endsWith(`@${expectedDomain}`)) {
    return { ok: false, reason: "wrong-domain" };
  }

  if (payload.email_verified !== true) {
    return { ok: false, reason: "unverified-email" };
  }

  return { ok: true, email };
}
