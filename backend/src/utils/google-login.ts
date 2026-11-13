/**
 * Logging in to Strapi's admin with Google: the parts that don't need Strapi,
 * kept here so they can be tested. The middleware that uses them is
 * src/middlewares/google-login.ts.
 *
 * Google only confirms who someone is: an account of the organisation's
 * Google Workspace, as in the donation admin panel's sign-in. Whether they
 * get in is decided by Strapi: their address must belong to an admin user
 * that an administrator added under Settings → Users.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const GOOGLE_LOGIN_PATH = "/google-login";
export const GOOGLE_CALLBACK_PATH = "/google-login/callback";
/** Tells the admin's login page whether to show the Google button. */
export const GOOGLE_STATUS_PATH = "/google-login/enabled";

/** Where the admin's login page is; it shows `?google-login=<error>`. */
export const ADMIN_LOGIN_PAGE = "/admin/auth/login";

const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** Why a Google login didn't end in the admin, as shown on the login page. */
export type GoogleLoginError =
  | "cancelled"
  | "failed"
  | "wrong-account"
  | "no-account";

export interface GoogleClient {
  clientId: string;
  clientSecret: string;
  /** The Workspace's domain, e.g. "example.org". */
  domain: string;
}

/**
 * The Google OAuth client, from STRAPI_GOOGLE_CLIENT_ID and
 * STRAPI_GOOGLE_CLIENT_SECRET: a client of its own, not the donation admin
 * panel's, so each has only its own redirect address and its own secret, and
 * either can be revoked alone. The Workspace is the panel's,
 * GOOGLE_WORKSPACE_DOMAIN. Without all three, Google login is off and
 * passwords work.
 */
export function googleClient(
  env: Record<string, string | undefined>,
): GoogleClient | null {
  const clientId = env.STRAPI_GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.STRAPI_GOOGLE_CLIENT_SECRET?.trim();
  const domain = env.GOOGLE_WORKSPACE_DOMAIN?.trim().toLowerCase();
  return clientId && clientSecret && domain
    ? { clientId, clientSecret, domain }
    : null;
}

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** PKCE: Google only gives out tokens for the code to whoever has `verifier`. */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** What a login keeps between leaving for Google and coming back. */
export interface PendingLogin {
  state: string;
  /** PKCE: proves to Google that the code is ours to exchange. */
  verifier: string;
  /** Comes back inside the ID token, tying it to this login. */
  nonce: string;
}

export function newLogin(): PendingLogin {
  return {
    state: randomToken(),
    verifier: randomToken(),
    nonce: randomToken(),
  };
}

export function authorizationUrl(
  login: PendingLogin,
  options: { clientId: string; domain: string; redirectUri: string },
): string {
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: "code",
    scope: "openid email",
    state: login.state,
    nonce: login.nonce,
    code_challenge: pkceChallenge(login.verifier),
    code_challenge_method: "S256",
    // Google's account chooser offers only the Workspace's accounts. Only
    // a hint: anyone can remove it, so the token is checked too.
    hd: options.domain,
    prompt: "select_account",
  });
  // Google's consent page has answered "400 malformed" to `+` between scopes
  // for people signed in to several accounts; `%20` works for everyone.
  return `${AUTHORIZATION_ENDPOINT}?${params.toString().replace(/\+/g, "%20")}`;
}

/** The state cookie holds the whole pending login. */
export function stateCookieValue(login: PendingLogin): string {
  return `${login.state}.${login.verifier}.${login.nonce}`;
}

/**
 * The pending login, when the state Google sent back is the one in the
 * cookie. Anything else (no cookie, an expired one, a forged callback) is
 * null.
 */
export function pendingLogin(
  cookie: string | undefined,
  returnedState: unknown,
): PendingLogin | null {
  if (!cookie || typeof returnedState !== "string") return null;
  const [state, verifier, nonce] = cookie.split(".");
  if (!state || !verifier || !nonce) return null;
  const expected = Buffer.from(state);
  const actual = Buffer.from(returnedState);
  return expected.length === actual.length && timingSafeEqual(expected, actual)
    ? { state, verifier, nonce }
    : null;
}

/** The login page, showing why the Google login didn't work. */
export function loginPageWithError(error: GoogleLoginError): string {
  return `${ADMIN_LOGIN_PAGE}?google-login=${error}`;
}
