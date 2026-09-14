import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import crypto from "node:crypto";
import { BRIDGEABLE_ADMIN_ROLE_CODES } from "../../../utils/admin-roles";
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
      where: { email: normalizedEmail },
      populate: ["roles"],
    })) as AdminUserRow | null;
    const isBridgeable = (adminUser?.roles ?? []).some((r) =>
      BRIDGEABLE_ADMIN_ROLE_CODES.has(r.code),
    );
    if (!isBridgeable) {
      return ctx.forbidden(
        "Your Strapi admin role does not have donation admin panel access",
      );
    }

    // Step 2: Find or create users-permissions user with the same email
    let user = (await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({
        where: { email: normalizedEmail },
      })) as UserPermissionsUser | null;

    if (!user) {
      // Assign the DonationAdmin role — not "authenticated", which public registrants also get
      const adminRole = (await strapi.db
        .query("plugin::users-permissions.role")
        .findOne({ where: { name: "DonationAdmin" } })) as Role | null;

      user = (await strapi.db.query("plugin::users-permissions.user").create({
        data: {
          email: normalizedEmail,
          username: normalizedEmail,
          // Random password — this user always authenticates via admin credentials
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

    return ctx.send({ jwt: token, user: { id: user.id, email: user.email } });
  },
});
