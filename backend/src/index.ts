import type { Core } from "@strapi/strapi";
import { pool } from "./db/client";
import { BRIDGEABLE_ADMIN_ROLE_CODES } from "./utils/admin-roles";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Bootstrap helpers
// ---------------------------------------------------------------------------

/**
 * Runs one bootstrap step without letting it take the whole app down. These
 * steps call Strapi's own admin/permission services (e.g. the api-token
 * service's update(), which throws on a token whose type was changed away
 * from "custom" in the Strapi UI) — none of that is awaited inside a
 * try/catch by Strapi itself, so an exception here would otherwise reject
 * bootstrap() and prevent Strapi from starting at all. A security hardening
 * step failing should degrade to "logged and skipped", never "the donation
 * platform won't boot".
 */
async function safely(
  strapi: Core.Strapi,
  name: string,
  fn: () => Promise<void>,
): Promise<void> {
  try {
    await fn();
  } catch (error: unknown) {
    strapi.log.error(
      `❌ Bootstrap step '${name}' failed — continuing startup anyway: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Creates the "Public API Token" used by the Next.js frontend if it doesn't
 * already exist, and writes its value to frontend/.env.local so developers
 * don't have to do it manually. Also keeps its permissions in sync with the
 * list below on every boot — this token is meant to be read-only public
 * content access, and something manually granted through the Strapi UI
 * (e.g. contact-submission read access, added by hand at some point) would
 * otherwise never get pruned.
 */
async function bootstrapApiToken(strapi: Core.Strapi): Promise<void> {
  const TOKEN_NAME = "Public API Token";

  // Actions for read-only public frontend access
  const permissions = [
    "api::blog-author.blog-author.find",
    "api::blog-author.blog-author.findOne",
    "api::blog-post.blog-post.find",
    "api::blog-post.blog-post.findOne",
    "api::cause.cause.find",
    "api::cause.cause.findOne",
    "api::global.global.find",
    "api::organization.organization.find",
    "api::organization.organization.findOne",
    "api::page.page.find",
    "api::page.page.findOne",
    "api::special-page.special-page.find",
    "api::special-page.special-page.findOne",
  ];

  type ApiTokenRow = { id: number };
  type ApiTokenService = {
    create(data: Record<string, unknown>): Promise<{ accessKey: string }>;
    update(id: number, data: Record<string, unknown>): Promise<unknown>;
  };
  const tokenService = strapi.service("admin::api-token") as ApiTokenService;

  const existing = (await strapi.db.query("admin::api-token").findOne({
    where: { name: TOKEN_NAME },
  })) as ApiTokenRow | null;

  if (existing) {
    // update() diffs against the token's current permissions — adds
    // anything missing from the list, removes anything not in it.
    await tokenService.update(existing.id, { permissions });
    strapi.log.info("✅ Public API Token permissions synced");
    return;
  }

  const result = await tokenService.create({
    name: TOKEN_NAME,
    type: "custom",
    lifespan: null, // unlimited
    description: "Frontend public read-only access",
    permissions,
  });

  // Write/update STRAPI_API_TOKEN in frontend/.env
  // process.cwd() is the backend directory when Strapi runs
  //
  // Deliberately not NEXT_PUBLIC_: that prefix inlines a value into the
  // browser bundle wherever it is referenced, and this token can read every
  // contact submission. It happens to be tree-shaken out today because only
  // server components touch the helper that reads it, but a single client
  // component importing fetchAPI would have shipped it to every visitor with
  // nothing to warn anyone. Without the prefix that mistake fails loudly in
  // dev instead, as an undefined token.
  const envPath = path.resolve(process.cwd(), "..", "frontend", ".env");
  const key = "STRAPI_API_TOKEN";
  const newLine = `${key}=${result.accessKey}`;

  if (fs.existsSync(envPath)) {
    const contents = fs.readFileSync(envPath, "utf8");
    const updated = contents.match(new RegExp(`^${key}=`, "m"))
      ? contents.replace(new RegExp(`^${key}=.*`, "m"), newLine)
      : `${contents.trimEnd()}\n${newLine}\n`;
    fs.writeFileSync(envPath, updated, "utf8");
  } else {
    fs.writeFileSync(
      envPath,
      `${newLine}\nNEXT_PUBLIC_STRAPI_API_URL=http://127.0.0.1:1337\nNEXT_PUBLIC_SITE_URL=http://localhost:3000\nPLAUSIBLE_DOMAIN=\n`,
      "utf8",
    );
  }

  strapi.log.info(`✅ Created Public API Token — written to frontend/.env`);
}

/**
 * Sets up the "DonationAdmin" role with access to all donation admin endpoints.
 *
 * Uses a dedicated role rather than "authenticated" so that publicly registered
 * users-permissions accounts cannot access sensitive donation endpoints.
 */
async function bootstrapDonationPermissions(
  strapi: Core.Strapi,
): Promise<void> {
  type Role = { id: number };
  type Permission = { id: number; action: string };

  const ROLE_NAME = "DonationAdmin";

  // Read-only actions granted to DonationAdmin
  const allowedActions = [
    "plugin::users-permissions.user.me",
    "api::donation.donation.export",
    "api::donation.donation.findTransaction",
    "api::organization.organization.find",
    "plugin::admin-panel.donation.list", // new admin-panel plugin endpoints (Phase 2+)
    "plugin::admin-panel.donation.findOne",
    "plugin::admin-panel.donation.update", // write path — move a donation between transfer rounds
    "plugin::admin-panel.donor.list",
    "plugin::admin-panel.donor.findOne",
    "plugin::admin-panel.recurringDonation.list",
    "plugin::admin-panel.recurringDonation.findOne",
    "plugin::admin-panel.recurringDonation.grid",
    "plugin::admin-panel.transfer.list",
    "plugin::admin-panel.transfer.findOne",
    "plugin::admin-panel.transfer.preview",
    "plugin::admin-panel.transfer.unlinkedOutgoing",
    "plugin::admin-panel.transfer.create", // write path — create a transfer round
    "plugin::admin-panel.transfer.update", // write path — attach donations / link payments
    "plugin::admin-panel.transfer.remove", // write path — delete an empty transfer
    "plugin::admin-panel.organization.stats",
    "plugin::admin-panel.dashboard.stats",
    "plugin::admin-panel.dashboard.charts",
    "plugin::admin-panel.statement.preview",
    "plugin::admin-panel.statement.apply", // write path — bank-statement import
    "plugin::admin-panel.bankTransaction.list",
    "plugin::admin-panel.bankTransaction.summary",
    "plugin::admin-panel.bankTransaction.findOne",
    "plugin::admin-panel.bankTransaction.update", // write path — reclassify a bank line
  ];

  // Defensive backstop for DonationAdmin. For an action whose *controller
  // method* was deleted entirely, users-permissions' own syncPermissions()
  // (runs during that plugin's bootstrap, before this one) already prunes
  // the stale row — this loop is a no-op for those in practice. It still
  // earns its keep for a route that gets disabled/re-scoped while the
  // controller method itself stays around, which syncPermissions can't see.
  const revokedActions = [
    "api::donation.donation.list", // superseded by plugin::admin-panel.donation.list
    "api::donation.donation.import",
    "api::donation.donation.deleteAll",
    "api::donation.donation.insertTransaction",
    "api::donation.donation.insertDonation",
    "api::donation.donation.migrateTips",
    "api::donation.donation.addDonationsToTransferByDate",
  ];

  // Find or create the dedicated DonationAdmin role
  let adminRole = (await strapi.db
    .query("plugin::users-permissions.role")
    .findOne({
      where: { name: ROLE_NAME },
    })) as Role | null;

  if (!adminRole) {
    adminRole = (await strapi.db
      .query("plugin::users-permissions.role")
      .create({
        data: {
          name: ROLE_NAME,
          description:
            "Donation admin panel access (read-only, plus bank-statement import and transfer-round management)",
          type: "donation_admin",
        },
      })) as Role;
    strapi.log.info(`✅ Created '${ROLE_NAME}' users-permissions role`);
  }

  // Grant any missing allowed permissions to DonationAdmin
  const existing = (await strapi.db
    .query("plugin::users-permissions.permission")
    .findMany({
      where: { role: adminRole.id, action: { $in: allowedActions } },
    })) as Permission[];

  const existingSet = new Set(existing.map((p) => p.action));
  const missing = allowedActions.filter((a) => !existingSet.has(a));

  if (missing.length > 0) {
    await Promise.all(
      missing.map((action) =>
        strapi.db.query("plugin::users-permissions.permission").create({
          data: { action, role: adminRole.id },
        }),
      ),
    );
    strapi.log.info(
      `✅ Granted ${missing.length} permission(s) to '${ROLE_NAME}' role`,
    );
  } else {
    strapi.log.info(`✅ DonationAdmin permissions already set — skipping`);
  }

  // Revoke previously-granted write permissions from DonationAdmin
  const writePermsOnAdmin = (await strapi.db
    .query("plugin::users-permissions.permission")
    .findMany({
      where: { role: adminRole.id, action: { $in: revokedActions } },
    })) as Permission[];

  if (writePermsOnAdmin.length > 0) {
    await Promise.all(
      writePermsOnAdmin.map((p) =>
        strapi.db
          .query("plugin::users-permissions.permission")
          .delete({ where: { id: p.id } }),
      ),
    );
    strapi.log.info(
      `✅ Revoked ${writePermsOnAdmin.length} write permission(s) from '${ROLE_NAME}' role`,
    );
  }

  // Revoke all donation admin permissions from 'authenticated' if previously granted
  const authenticatedRole = (await strapi.db
    .query("plugin::users-permissions.role")
    .findOne({
      where: { type: "authenticated" },
    })) as Role | null;

  if (authenticatedRole) {
    const allActions = [...allowedActions, ...revokedActions];
    const stalePerms = (await strapi.db
      .query("plugin::users-permissions.permission")
      .findMany({
        where: { role: authenticatedRole.id, action: { $in: allActions } },
      })) as Permission[];

    if (stalePerms.length > 0) {
      await Promise.all(
        stalePerms.map((p) =>
          strapi.db
            .query("plugin::users-permissions.permission")
            .delete({ where: { id: p.id } }),
        ),
      );
      strapi.log.info(
        `✅ Revoked ${stalePerms.length} stale permission(s) from 'authenticated' role`,
      );
    }
  }
}

/**
 * Closes the second login path into the admin panel. The admin panel
 * authenticates through the Strapi admin bridge (see
 * src/api/admin-auth/controllers/admin-auth.ts), which validates Strapi admin
 * credentials and then issues its own users-permissions JWT. The Public role
 * must not also expose users-permissions' own login/register/password-reset
 * endpoints — otherwise anyone who can read a DonationAdmin's mailbox could
 * self-serve donor access via forgot-password, without ever knowing a Strapi
 * admin password.
 */
async function hardenPublicAuth(strapi: Core.Strapi): Promise<void> {
  type Role = { id: number };
  type Permission = { id: number; action: string };

  const blockedAuthActions = [
    "plugin::users-permissions.auth.callback", // POST /api/auth/local
    "plugin::users-permissions.auth.register",
    "plugin::users-permissions.auth.forgotPassword",
    "plugin::users-permissions.auth.resetPassword",
    "plugin::users-permissions.auth.connect", // OAuth providers — unused, disabled anyway
    "plugin::users-permissions.auth.emailConfirmation",
    "plugin::users-permissions.auth.sendEmailConfirmation",
    "plugin::users-permissions.auth.refresh",
    "plugin::users-permissions.auth.logout",
  ];

  const publicRole = (await strapi.db
    .query("plugin::users-permissions.role")
    .findOne({ where: { type: "public" } })) as Role | null;

  if (publicRole) {
    const stalePerms = (await strapi.db
      .query("plugin::users-permissions.permission")
      .findMany({
        where: { role: publicRole.id, action: { $in: blockedAuthActions } },
      })) as Permission[];

    if (stalePerms.length > 0) {
      await Promise.all(
        stalePerms.map((p) =>
          strapi.db
            .query("plugin::users-permissions.permission")
            .delete({ where: { id: p.id } }),
        ),
      );
      strapi.log.info(
        `✅ Revoked ${stalePerms.length} users-permissions auth action(s) from 'public' role`,
      );
    }
  }

  // Public self-registration would let anyone squat a users-permissions
  // account on a future admin's email before that admin's first bridge
  // login claims it.
  const pluginStore = strapi.store({
    type: "plugin",
    name: "users-permissions",
  });
  const advancedRaw = await pluginStore.get({ key: "advanced" });
  const advanced =
    advancedRaw && typeof advancedRaw === "object"
      ? (advancedRaw as Record<string, unknown>)
      : null;

  if (advanced && advanced.allow_register !== false) {
    await pluginStore.set({
      key: "advanced",
      value: { ...advanced, allow_register: false },
    });
    strapi.log.info("✅ Disabled users-permissions public self-registration");
  }
}

/**
 * Every users-permissions account (now that public self-registration is off)
 * only exists to be bridged from a real Strapi admin login. If that admin is
 * deactivated, removed, or moved to a Strapi role that shouldn't have this
 * access any more (see BRIDGEABLE_ADMIN_ROLE_CODES), the bridged account must stop
 * working too — otherwise offboarding, or narrowing, a Strapi admin leaves a
 * working side door into donor data.
 *
 * Sweeps every users-permissions user, not just ones currently in
 * DonationAdmin — an operator moving someone to a different, more
 * restricted users-permissions role (which the bridge's own comment
 * suggests as an option) must not make them invisible to this check.
 *
 * Only ever blocks, never unblocks — if this incorrectly blocks someone,
 * restore access explicitly in the Strapi UI rather than relying on this to
 * self-heal.
 */
async function blockOrphanedDonationAdmins(strapi: Core.Strapi): Promise<void> {
  type UpUser = { id: number; email: string; blocked: boolean };
  type AdminUser = { email: string; roles?: Array<{ code: string }> };

  const [bridgedUsers, admins] = await Promise.all([
    strapi.db.query("plugin::users-permissions.user").findMany({}) as Promise<
      UpUser[]
    >,
    strapi.db.query("admin::user").findMany({
      where: { isActive: true },
      populate: ["roles"],
    }) as Promise<AdminUser[]>,
  ]);

  // Mirrors the allowlist admin-auth.ts uses to decide who gets bridged in —
  // an admin who's still active but lost the qualifying role is treated the
  // same as one who was deactivated outright.
  const eligibleEmails = new Set(
    admins
      .filter((a) =>
        (a.roles ?? []).some((r) => BRIDGEABLE_ADMIN_ROLE_CODES.has(r.code)),
      )
      .map((a) => a.email.toLowerCase()),
  );

  const toBlock = bridgedUsers.filter(
    (u) => !u.blocked && !eligibleEmails.has(u.email.toLowerCase()),
  );

  if (toBlock.length > 0) {
    await Promise.all(
      toBlock.map((u) =>
        strapi.db
          .query("plugin::users-permissions.user")
          .update({ where: { id: u.id }, data: { blocked: true } }),
      ),
    );
    strapi.log.info(
      `✅ Blocked ${toBlock.length} account(s) with no matching active, eligible Strapi admin`,
    );
  }
}

/**
 * Every per-IP defence in this app (the bridge login lockout, the global
 * limiter, the address recorded on each audit row) is only as good as
 * ctx.request.ip, and behind a reverse proxy that is the proxy's own address
 * unless SERVER_PROXY is on. That failure is completely silent at runtime —
 * the limiters still "work", they just all share one bucket — so say so at
 * startup rather than letting a missing env var look like a working defence.
 */
function warnIfProxyUntrusted(strapi: Core.Strapi): void {
  if (strapi.config.get("server.proxy.koa")) return;
  if (process.env.NODE_ENV !== "production") return;
  strapi.log.warn(
    "⚠️  SERVER_PROXY is off: every request will report the reverse proxy's " +
      "address, so login lockout and rate limits share one bucket and audit " +
      "rows cannot be attributed. Turn it on only once the proxy overwrites " +
      "X-Forwarded-For with the real client address.",
  );
}

export default {
  register(/*{ strapi }: { strapi: Core.Strapi }*/) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // CRITICAL: Prevent data loss from unmigrated Strapi donation tables
    // Check if Strapi database still contains donation data that hasn't been migrated
    try {
      // Connect to Strapi database to check for legacy donation data
      // strapi.db.connection is an internal Knex instance not exposed in Strapi's public types
      type KnexConn = {
        raw: (sql: string) => Promise<{ rows: Array<Record<string, string>> }>;
      };
      const strapiDbConnection = (
        strapi.db as unknown as { connection: KnexConn }
      ).connection;

      // Check if Strapi still has donation tables with data
      // First check if table exists
      const tableCheck = await strapiDbConnection.raw(`
        SELECT COUNT(*) as count FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'donations'
      `);

      const hasDonationTable = Number(tableCheck.rows[0]?.count) > 0;
      let donationCount = 0;

      // If table exists, count rows
      if (hasDonationTable) {
        const rowCheck = await strapiDbConnection.raw(
          `SELECT COUNT(*) as count FROM donations`,
        );
        donationCount = Number(rowCheck.rows[0]?.count) || 0;
      }

      if (hasDonationTable && donationCount > 0) {
        console.error("\n");
        console.error(
          "═══════════════════════════════════════════════════════════════",
        );
        console.error("  ❌ CRITICAL ERROR: DONATION DATA LOSS PREVENTION");
        console.error(
          "═══════════════════════════════════════════════════════════════",
        );
        console.error(
          "\n⚠️  Your Strapi database contains",
          donationCount,
          "donations that have NOT been migrated!\n",
        );
        console.error(
          "Starting Strapi with the current code will DELETE these donation tables",
        );
        console.error("because the schema.json files have been removed.\n");
        console.error("🛑 YOU MUST MIGRATE YOUR DONATION DATA FIRST!\n");
        console.error("Migration steps:");
        console.error(
          "  1. Review the migration guide: backend/MIGRATION_PLAN.md",
        );
        console.error(
          "  2. Set up Drizzle database (DRIZZLE_DATABASE_NAME in .env)",
        );
        console.error(
          "  3. Run: node src/db/migrations/02-migrate-to-drizzle.js",
        );
        console.error("  4. Verify migration completed successfully");
        console.error("  5. Restart Strapi\n");
        console.error("If you've already migrated and see this error:");
        console.error(
          "  - Check that migration completed (verify Drizzle database has data)",
        );
        console.error(
          "  - The old Strapi donation tables can be dropped manually after verification\n",
        );
        console.error(
          "═══════════════════════════════════════════════════════════════\n",
        );
        process.exit(1);
      }

      // If no Strapi donation data, verify Drizzle is configured (unless fresh install)
      // Check if we have organizations (indicates not a fresh install)
      const orgCount = await strapiDbConnection
        .raw(
          `
        SELECT COUNT(*) as count FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'organizations'
      `,
        )
        .then((result) => Number(result.rows[0]?.count) || 0);

      const hasOrganizations = orgCount > 0;

      if (hasOrganizations) {
        // Not a fresh install, verify Drizzle is set up
        try {
          await pool.query("SELECT 1");
          strapi.log.info("✅ Drizzle database connection verified");
        } catch (error: unknown) {
          console.error("\n❌ WARNING: Cannot connect to Drizzle database\n");
          console.error(
            "Error:",
            error instanceof Error ? error.message : String(error),
          );
          console.error(
            "\nThis appears to be an existing installation, but Drizzle is not configured.",
          );
          console.error("Please ensure:");
          console.error(
            "  - DRIZZLE_DATABASE_NAME environment variable is set",
          );
          console.error("  - Database connection details are correct in .env");
          console.error("  - Drizzle database exists and is accessible\n");
          console.error("Current environment:");
          console.error(
            "  - DRIZZLE_DATABASE_NAME:",
            process.env.DRIZZLE_DATABASE_NAME || "❌ NOT SET",
          );
          console.error(
            "  - DATABASE_HOST:",
            process.env.DATABASE_HOST || "localhost",
          );
          console.error(
            "  - DATABASE_PORT:",
            process.env.DATABASE_PORT || "5432\n",
          );
        }
      } else {
        // Fresh installation - Drizzle will be set up during first donation
        strapi.log.info(
          "Fresh installation detected - Drizzle will be configured when needed",
        );
      }
    } catch (error: unknown) {
      console.error(
        "\n❌ Error during startup validation:",
        error instanceof Error ? error.message : String(error),
      );
      console.error("If this persists, check database connectivity\n");
      // Don't exit - let Strapi handle DB connection errors
    }

    await safely(strapi, "bootstrapApiToken", () => bootstrapApiToken(strapi));
    await safely(strapi, "bootstrapDonationPermissions", () =>
      bootstrapDonationPermissions(strapi),
    );
    await safely(strapi, "hardenPublicAuth", () => hardenPublicAuth(strapi));
    await safely(strapi, "blockOrphanedDonationAdmins", () =>
      blockOrphanedDonationAdmins(strapi),
    );
    warnIfProxyUntrusted(strapi);

    // Signal PM2 that this worker is ready, which is what `wait_ready` in the
    // ecosystem config blocks on and what the deploy script polls before it
    // touches the second worker.
    //
    // It has to be the httpServer's own `listening` event, not the end of
    // bootstrap: Strapi calls listen() *after* bootstrap returns, so signalling
    // from here directly would tell PM2 the worker is up while its socket is
    // still closed — and PM2 would then let the deploy proceed to restart the
    // other worker, which is the one moment both can be down at once. The
    // already-listening branch is there in case that ordering ever changes.
    if (process.send) {
      const { httpServer } = strapi.server;
      const signalReady = () => {
        process.send?.("ready");
        strapi.log.info("✅ PM2 ready signal sent - accepting connections");
      };
      if (httpServer.listening) signalReady();
      else httpServer.once("listening", signalReady);
    }
  },
};
