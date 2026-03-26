import type { Core } from "@strapi/strapi";
import { pool } from "./db/client";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Bootstrap helpers
// ---------------------------------------------------------------------------

/**
 * Creates the "Public API Token" used by the Next.js frontend if it doesn't
 * already exist, and writes its value to frontend/.env.local so developers
 * don't have to do it manually.
 */
async function bootstrapApiToken(strapi: Core.Strapi): Promise<void> {
  const TOKEN_NAME = "Public API Token";

  const existing = await strapi.db.query("admin::api-token").findOne({
    where: { name: TOKEN_NAME },
  });

  if (existing) {
    strapi.log.info("✅ Public API Token already exists — skipping creation");
    return;
  }

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

  type ApiTokenService = {
    create(data: Record<string, unknown>): Promise<{ accessKey: string }>;
  };
  const tokenService = strapi.service("admin::api-token") as ApiTokenService;
  const result = await tokenService.create({
    name: TOKEN_NAME,
    type: "custom",
    lifespan: null, // unlimited
    description: "Frontend public read-only access",
    permissions,
  });

  // Write/update NEXT_PUBLIC_STRAPI_API_TOKEN in frontend/.env
  // process.cwd() is the backend directory when Strapi runs
  const envPath = path.resolve(process.cwd(), "..", "frontend", ".env");
  const key = "NEXT_PUBLIC_STRAPI_API_TOKEN";
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
    "api::donation.donation.list", // legacy — kept during transition, revoked at Cleanup
    "api::donation.donation.export",
    "api::donation.donation.findTransaction",
    "api::organization.organization.find",
    "plugin::admin-panel.donation.list", // new admin-panel plugin endpoints (Phase 2+)
    "plugin::admin-panel.donation.findOne",
    "plugin::admin-panel.donor.list",
    "plugin::admin-panel.donor.findOne",
    "plugin::admin-panel.recurringDonation.list",
    "plugin::admin-panel.recurringDonation.findOne",
    "plugin::admin-panel.transfer.list",
    "plugin::admin-panel.transfer.findOne",
    "plugin::admin-panel.organization.stats",
  ];

  // Write actions that must be actively revoked from DonationAdmin if previously granted
  const revokedActions = [
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
          description: "Read-only access to donation admin endpoints",
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

    await bootstrapApiToken(strapi);
    await bootstrapDonationPermissions(strapi);

    // Signal PM2 that Strapi is ready to accept connections
    // This enables zero-downtime reloads with pm2 reload
    if (process.send) {
      process.send("ready");
      strapi.log.info(
        "✅ PM2 ready signal sent - application fully initialized",
      );
    }
  },
};
