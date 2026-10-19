import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import crypto from "node:crypto";
import { BRIDGEABLE_ADMIN_ROLE_CODES } from "../../../utils/admin-roles";
import { verifyGoogleIdToken } from "../../../utils/google-id-token";
import {
  FixedWindowLimiter,
  isProxyAddress,
} from "../../../utils/rate-limiter";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// One account, as seen from one address: the actual brute-force guard, and
// tight because guessing a specific person's password is the thing worth
// stopping.
const perEmailAttempts = new FixedWindowLimiter(5, LOGIN_WINDOW_MS);

// One address, across every account it tries: catches someone spraying a list
// of addresses from a single source. Deliberately loose — several colleagues
// behind one office NAT mistyping their passwords must not lock each other
// out, which is exactly what the single shared bucket this replaced did.
const perIpAttempts = new FixedWindowLimiter(20, LOGIN_WINDOW_MS);

interface UserPermissionsUser {
  id: number;
  email: string;
}

interface Role {
  id: number;
  name: string;
}

type BridgeResult =
  | { ok: true; jwt: string; user: { id: number; email: string } }
  | { ok: false; message: string };

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Bridge login: validates Strapi admin credentials, then finds or creates
   * a matching users-permissions user and returns a users-permissions JWT.
   *
   * This lets the admin panel use the standard users-permissions auth system
   * (which works natively on /api/* routes) while keeping Strapi admin accounts
   * as the single source of truth for identity.
   *
   * New users are provisioned automatically on first login with the
   * "DonationAdmin" role. Assign them a more restricted role in the Strapi UI
   * if needed.
   */
  async login(ctx: Context) {
    const { email, password } = ctx.request.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return ctx.badRequest("Email and password are required");
    }

    const normalizedEmail = email.toLowerCase();
    const emailKey = `${ctx.request.ip}|${normalizedEmail}`;
    const ipKey = ctx.request.ip;
    const ipKeyIsReal = !isProxyAddress(ipKey);

    if (
      perEmailAttempts.isLimited(emailKey) ||
      (ipKeyIsReal && perIpAttempts.isLimited(ipKey))
    ) {
      // The status must be passed to send(): Strapi defines it as
      // `send(data, status = 200)` and assigns that status unconditionally, so
      // setting ctx.status beforehand is silently overwritten. This endpoint
      // spent its whole life answering lockouts with 200 and no JWT, which the
      // admin panel read as a successful login and stored as an "undefined"
      // cookie.
      return ctx.send(
        { error: "Too many login attempts. Try again in 15 minutes." },
        429,
      );
    }

    // Step 1: Validate against Strapi admin auth (reuse its exact logic)
    const port = process.env.PORT ?? 1337;
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 5000);
    let adminRes: Response;
    try {
      adminRes = await fetch(`http://localhost:${port}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: abortController.signal,
      });
    } catch {
      return ctx.internalServerError("Login service unavailable");
    } finally {
      clearTimeout(timeout);
    }

    if (!adminRes.ok) {
      perEmailAttempts.record(emailKey);
      if (ipKeyIsReal) perIpAttempts.record(ipKey);
      return ctx.unauthorized("Invalid credentials");
    }

    const result = await bridge(strapi, normalizedEmail);
    if (!result.ok) return ctx.forbidden(result.message);
    return ctx.send({ jwt: result.jwt, user: result.user });
  },

  /**
   * Google sign-in, for the same people as login(): someone with an active
   * Strapi admin account in a bridgeable role. Google only stands in for the
   * password; it grants nothing by itself, so being in the Workspace without
   * such an account gets you nowhere.
   *
   * The admin panel runs the OAuth exchange and hands over the ID token it
   * got from Google, with the nonce it started the sign-in with. Everything
   * that decides access is checked here, against Google's signature, so the
   * panel can't vouch for anyone on its own.
   */
  async google(ctx: Context) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const domain = process.env.GOOGLE_WORKSPACE_DOMAIN;
    if (!clientId || !domain) {
      return ctx.notFound("Google sign-in is not configured");
    }

    const { idToken, nonce } = ctx.request.body as {
      idToken?: string;
      nonce?: string;
    };
    if (!idToken || !nonce) {
      return ctx.badRequest("idToken and nonce are required");
    }

    const identity = await verifyGoogleIdToken(idToken, {
      clientId,
      domain,
      nonce,
    });
    if (!identity.ok) {
      // The reason lets the panel say which, without passing on free text.
      return ctx.unauthorized(
        identity.reason === "wrong-domain"
          ? "This Google account is not on the organisation's domain"
          : "Google sign-in failed",
        { reason: identity.reason },
      );
    }

    // The password path gets this from /admin/login, which refuses inactive
    // admins. Nothing here has checked it yet.
    const adminUser = (await strapi.db.query("admin::user").findOne({
      where: { email: identity.email },
    })) as { isActive?: boolean; blocked?: boolean | null } | null;
    if (!adminUser || adminUser.isActive !== true || adminUser.blocked) {
      return ctx.forbidden("There is no active admin account for this email");
    }

    const result = await bridge(strapi, identity.email);
    if (!result.ok) return ctx.forbidden(result.message);
    return ctx.send({ jwt: result.jwt, user: result.user });
  },
});

/**
 * The part both sign-ins share: given an admin's email, already proven to be
 * theirs, admit them if their Strapi role allows it, find or create the
 * matching users-permissions user, and issue its JWT.
 */
async function bridge(
  strapi: Core.Strapi,
  email: string,
): Promise<BridgeResult> {
  // Step 1b: only bridge admins whose Strapi role is meant to carry this
  // level of access, not every role that can merely log into Strapi.
  // /admin/login's response user object does NOT include populated roles —
  // Strapi's own checkCredentials() fetches the admin user with no
  // `populate` at all, so `roles` is undefined on it and gets dropped
  // entirely by JSON serialization. Query the admin user directly instead
  // of trusting that response shape (same populate:["roles"] pattern
  // blockOrphanedDonationAdmins already uses, and already proven live
  // against this exact database).
  type AdminUserRow = { roles?: Array<{ code: string }> };
  const adminUser = (await strapi.db.query("admin::user").findOne({
    where: { email },
    populate: ["roles"],
  })) as AdminUserRow | null;
  const isBridgeable = (adminUser?.roles ?? []).some((r) =>
    BRIDGEABLE_ADMIN_ROLE_CODES.has(r.code),
  );
  if (!isBridgeable) {
    return {
      ok: false,
      message:
        "Your Strapi admin role does not have donation admin panel access",
    };
  }

  // Step 2: Find or create users-permissions user with the same email
  let user = (await strapi.db.query("plugin::users-permissions.user").findOne({
    where: { email },
  })) as UserPermissionsUser | null;

  if (!user) {
    // Assign the DonationAdmin role — not "authenticated", which public registrants also get
    const adminRole = (await strapi.db
      .query("plugin::users-permissions.role")
      .findOne({ where: { name: "DonationAdmin" } })) as Role | null;

    user = (await strapi.db.query("plugin::users-permissions.user").create({
      data: {
        email,
        username: email,
        // Random password — this user only ever signs in through this bridge
        password: crypto.randomBytes(32).toString("hex"),
        confirmed: true,
        provider: "local",
        role: adminRole?.id,
      },
    })) as UserPermissionsUser;
  }

  // Step 3: Issue a users-permissions JWT
  const token = await (
    strapi.plugin("users-permissions").service("jwt") as {
      issue: (payload: Record<string, unknown>) => Promise<string>;
    }
  ).issue({ id: user.id });

  return { ok: true, jwt: token, user: { id: user.id, email: user.email } };
}
