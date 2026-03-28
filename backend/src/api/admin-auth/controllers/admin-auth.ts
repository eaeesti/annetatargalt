import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import crypto from "node:crypto";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

// Prune expired entries once per window to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of loginAttempts) {
    if (now > record.resetAt) loginAttempts.delete(ip);
  }
}, LOGIN_WINDOW_MS);

function checkRateLimit(ip: string): boolean {
  const record = loginAttempts.get(ip);
  if (!record || Date.now() > record.resetAt) return false;
  return record.count >= LOGIN_MAX_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    record.count++;
  }
}

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

    if (checkRateLimit(ctx.request.ip)) {
      ctx.status = 429;
      return ctx.send({
        error: "Too many login attempts. Try again in 15 minutes.",
      });
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
      recordFailedAttempt(ctx.request.ip);
      return ctx.unauthorized("Invalid credentials");
    }

    const normalizedEmail = email.toLowerCase();

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
