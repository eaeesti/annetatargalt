"use strict";

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // CRITICAL: Prevent data loss from unmigrated Strapi donation tables
    // Check if Strapi database still contains donation data that hasn't been migrated
    try {
      // Connect to Strapi database to check for legacy donation data
      const strapiDbConnection = strapi.db.connection;

      // Check if Strapi still has donation tables with data
      // First check if table exists
      const tableCheck = await strapiDbConnection.raw(`
        SELECT COUNT(*) as count FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'donations'
      `);

      const hasDonationTable = tableCheck.rows[0]?.count > 0;
      let donationCount = 0;

      // If table exists, count rows
      if (hasDonationTable) {
        const rowCheck = await strapiDbConnection.raw(`SELECT COUNT(*) as count FROM donations`);
        donationCount = Number(rowCheck.rows[0]?.count) || 0;
      }

      if (hasDonationTable && donationCount > 0) {
        console.error("\n");
        console.error("═══════════════════════════════════════════════════════════════");
        console.error("  ❌ CRITICAL ERROR: DONATION DATA LOSS PREVENTION");
        console.error("═══════════════════════════════════════════════════════════════");
        console.error("\n⚠️  Your Strapi database contains", donationCount, "donations that have NOT been migrated!\n");
        console.error("Starting Strapi with the current code will DELETE these donation tables");
        console.error("because the schema.json files have been removed.\n");
        console.error("🛑 YOU MUST MIGRATE YOUR DONATION DATA FIRST!\n");
        console.error("Migration steps:");
        console.error("  1. Review the migration guide: backend/MIGRATION_PLAN.md");
        console.error("  2. Set up Drizzle database (DRIZZLE_DATABASE_NAME in .env)");
        console.error("  3. Run: node src/db/migrations/02-migrate-to-drizzle.js");
        console.error("  4. Verify migration completed successfully");
        console.error("  5. Restart Strapi\n");
        console.error("If you've already migrated and see this error:");
        console.error("  - Check that migration completed (verify Drizzle database has data)");
        console.error("  - The old Strapi donation tables can be dropped manually after verification\n");
        console.error("═══════════════════════════════════════════════════════════════\n");
        process.exit(1);
      }

      // If no Strapi donation data, verify Drizzle is configured (unless fresh install)
      // Check if we have organizations (indicates not a fresh install)
      const orgCount = await strapiDbConnection.raw(`
        SELECT COUNT(*) as count FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'organizations'
      `).then(result => result.rows[0]?.count || 0);

      const hasOrganizations = orgCount > 0;

      if (hasOrganizations) {
        // Not a fresh install, verify Drizzle is set up
        const { pool } = require("./db/client");

        try {
          await pool.query("SELECT 1");
          strapi.log.info("✅ Drizzle database connection verified");
        } catch (error) {
          console.error("\n❌ WARNING: Cannot connect to Drizzle database\n");
          console.error("Error:", error.message);
          console.error("\nThis appears to be an existing installation, but Drizzle is not configured.");
          console.error("Please ensure:");
          console.error("  - DRIZZLE_DATABASE_NAME environment variable is set");
          console.error("  - Database connection details are correct in .env");
          console.error("  - Drizzle database exists and is accessible\n");
          console.error("Current environment:");
          console.error("  - DRIZZLE_DATABASE_NAME:", process.env.DRIZZLE_DATABASE_NAME || "❌ NOT SET");
          console.error("  - DATABASE_HOST:", process.env.DATABASE_HOST || "localhost");
          console.error("  - DATABASE_PORT:", process.env.DATABASE_PORT || "5432\n");
        }
      } else {
        // Fresh installation - Drizzle will be set up during first donation
        strapi.log.info("Fresh installation detected - Drizzle will be configured when needed");
      }

    } catch (error) {
      console.error("\n❌ Error during startup validation:", error.message);
      console.error("If this persists, check database connectivity\n");
      // Don't exit - let Strapi handle DB connection errors
    }
  },
};
