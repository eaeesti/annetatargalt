/**
 * Strapi admin login with Google instead of passwords. Off until its Google
 * client's ID and secret and the Workspace's domain are all set
 * (googleClient); until then passwords work as before.
 *
 * GET /google-login           → Google's account chooser
 * GET /google-login/callback  → back from Google: logs the user in to the
 *                               admin, as Strapi's own login would
 * GET /google-login/enabled   → { enabled, domain }, for the login page
 *
 * Only active admin users that exist already get in. An invited user who
 * never set a password is activated by their first Google login, so invite
 * links aren't needed; one an administrator switched off stays out. The
 * admin's password routes refuse everyone, Super Admins included: if Google
 * login ever breaks, removing the client's secret turns passwords back on.
 * Strapi's own SSO needs its Enterprise plan, so this is ours.
 */
import type { Core } from "@strapi/strapi";
import { randomUUID } from "node:crypto";
import { strapiTable } from "../strapi-internals";
import { verifyGoogleIdToken } from "../utils/google-id-token";
import {
  authorizationUrl,
  GOOGLE_CALLBACK_PATH,
  GOOGLE_LOGIN_PATH,
  GOOGLE_STATUS_PATH,
  googleClient,
  loginPageWithError,
  newLogin,
  pendingLogin,
  stateCookieValue,
  TOKEN_ENDPOINT,
  type GoogleClient,
  type GoogleLoginError,
} from "../utils/google-login";
import { isRecord } from "../utils/narrow";

type Context = Parameters<Core.MiddlewareHandler>[0];

/**
 * The login's state, PKCE verifier and nonce, between leaving for Google and
 * coming back. Over HTTPS it's a __Host- cookie, which browsers only accept
 * from this host itself: a site on another subdomain could otherwise plant a
 * state it got from /google-login, and with it log a visitor in to the
 * planter's own admin account. Browsers only take that prefix on secure
 * cookies with path "/", so plain HTTP (development) keeps a plain name.
 */
function stateCookie(ctx: Context): { name: string; path: string } {
  return secure(ctx)
    ? { name: "__Host-strapi_google_login", path: "/" }
    : { name: "strapi_google_login", path: GOOGLE_LOGIN_PATH };
}

/**
 * The cookies Strapi's own login sets, with Strapi's default names and path
 * (config/admin.js doesn't change them): the refresh token, which only the
 * server reads, and the access token, which the admin reads when it loads.
 */
const REFRESH_COOKIE = "strapi_admin_refresh";
const ACCESS_COOKIE = "jwtToken";
const ADMIN_COOKIE_PATH = "/admin";

/**
 * The admin routes that log in or set a password, matched the way Strapi's
 * router (@koa/router) matches them: whatever the case, and with or without
 * a trailing slash. An exact comparison would let "/admin/login/" and
 * "/admin/LOGIN" through to the password check. register-admin creates the
 * first Super Admin, and Strapi refuses it once any admin exists.
 */
const PASSWORD_ROUTE =
  /^\/admin\/(login|register|register-admin|reset-password|forgot-password)\/?$/i;

const PASSWORD_REFUSED =
  "Passwords are turned off: log in with the “Log in with Google” button.";

interface AdminUser {
  id: number;
  isActive: boolean;
  blocked: boolean | null;
  /** Set while an invited user hasn't registered. */
  registrationToken: string | null;
}

/** Secure cookies as Strapi sets them: in production, over HTTPS. */
function secure(ctx: Context): boolean {
  return process.env.NODE_ENV === "production" && ctx.request.secure;
}

function refusePassword(ctx: Context) {
  ctx.status = 403;
  ctx.body = {
    data: null,
    error: {
      status: 403,
      name: "ForbiddenError",
      message: PASSWORD_REFUSED,
      details: {},
    },
  };
}

const googleLogin: Core.MiddlewareFactory = (_config, { strapi }) => {
  const adminUsers = strapiTable<AdminUser>(strapi, "admin::user");

  const redirectUri = (ctx: Context) => {
    const base = strapi.config.get<string>("server.url") || ctx.origin;
    return `${base.replace(/\/$/, "")}${GOOGLE_CALLBACK_PATH}`;
  };

  const start = (ctx: Context, client: GoogleClient) => {
    const login = newLogin();
    // Signed, so its value can't be made up, and host-only (stateCookie).
    const cookie = stateCookie(ctx);
    ctx.cookies.set(cookie.name, stateCookieValue(login), {
      signed: true,
      httpOnly: true,
      secure: secure(ctx),
      sameSite: "lax",
      path: cookie.path,
      maxAge: 10 * 60 * 1000,
      overwrite: true,
    });
    ctx.redirect(
      authorizationUrl(login, {
        clientId: client.clientId,
        domain: client.domain,
        redirectUri: redirectUri(ctx),
      }),
    );
  };

  /** The Google account's Workspace address, or why there isn't one. */
  const googleEmail = async (
    ctx: Context,
    client: GoogleClient,
  ): Promise<{ email: string } | { error: GoogleLoginError }> => {
    const cookie = stateCookie(ctx);
    const login = pendingLogin(
      ctx.cookies.get(cookie.name, { signed: true }),
      ctx.query.state,
    );
    // Browsers ignore a __Host- cookie's removal unless it's secure too.
    ctx.cookies.set(cookie.name, null, {
      signed: true,
      secure: secure(ctx),
      path: cookie.path,
    });
    if (ctx.query.error) return { error: "cancelled" };
    const code = ctx.query.code;
    if (!login || typeof code !== "string") return { error: "failed" };

    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      body: new URLSearchParams({
        code,
        client_id: client.clientId,
        client_secret: client.clientSecret,
        redirect_uri: redirectUri(ctx),
        grant_type: "authorization_code",
        code_verifier: login.verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      strapi.log.warn(`Google login: token request got ${response.status}`);
      return { error: "failed" };
    }
    const tokens: unknown = await response.json();
    const idToken = isRecord(tokens) ? tokens.id_token : undefined;
    if (typeof idToken !== "string") return { error: "failed" };

    const identity = await verifyGoogleIdToken(idToken, {
      clientId: client.clientId,
      domain: client.domain,
      nonce: login.nonce,
    });
    if (!identity.ok) {
      strapi.log.warn(
        identity.reason === "wrong-domain"
          ? "Google login: not an account of the Workspace"
          : `Google login: token refused (${identity.reason})`,
      );
      return {
        error: identity.reason === "wrong-domain" ? "wrong-account" : "failed",
      };
    }
    return { email: identity.email };
  };

  const callback = async (ctx: Context, client: GoogleClient) => {
    const result = await googleEmail(ctx, client);
    if ("error" in result) {
      ctx.redirect(loginPageWithError(result.error));
      return;
    }
    const { email } = result;
    const user = await adminUsers.findOne({
      where: { email: { $eqi: email } },
    });
    // Inactive without a registration token: an administrator switched the
    // user off, so they stay out.
    const invited = Boolean(user && !user.isActive && user.registrationToken);
    if (!user || user.blocked || (!user.isActive && !invited)) {
      strapi.log.info(`Google login: no admin access for ${email}`);
      ctx.redirect(loginPageWithError("no-account"));
      return;
    }
    if (invited) {
      // Invited and never registered: Google confirmed the address.
      await adminUsers.update({
        where: { id: user.id },
        data: { isActive: true, registrationToken: null },
      });
    }

    const sessions = strapi.sessionManager("admin");
    const { token: refreshToken } = await sessions.generateRefreshToken(
      String(user.id),
      randomUUID(),
      { type: "session" },
    );
    const access = await sessions.generateAccessToken(refreshToken);
    if ("error" in access) {
      ctx.redirect(loginPageWithError("failed"));
      return;
    }
    ctx.cookies.set(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: secure(ctx),
      sameSite: "lax",
      path: ADMIN_COOKIE_PATH,
      overwrite: true,
    });
    ctx.cookies.set(ACCESS_COOKIE, access.token, {
      httpOnly: false,
      secure: secure(ctx),
      sameSite: "lax",
      path: ADMIN_COOKIE_PATH,
      overwrite: true,
    });
    strapi.log.info(`Google login: ${email}`);
    ctx.redirect("/admin");
  };

  return async (ctx, next) => {
    const client = googleClient(process.env);
    if (ctx.method === "GET" && ctx.path === GOOGLE_STATUS_PATH) {
      ctx.body = { enabled: Boolean(client), domain: client?.domain ?? null };
      return;
    }
    if (!client) return next();

    if (ctx.method === "GET" && ctx.path === GOOGLE_LOGIN_PATH) {
      start(ctx, client);
      return;
    }
    if (ctx.method === "GET" && ctx.path === GOOGLE_CALLBACK_PATH) {
      try {
        await callback(ctx, client);
      } catch (error: unknown) {
        strapi.log.error(
          `Google login failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        ctx.redirect(loginPageWithError("failed"));
      }
      return;
    }
    if (ctx.method === "POST" && PASSWORD_ROUTE.test(ctx.path)) {
      refusePassword(ctx);
      return;
    }
    return next();
  };
};

export default googleLogin;
