/**
 * Step 0: Populate organizationInternalId fields using direct database queries
 *
 * This script populates the organizationInternalId field by querying
 * the Strapi linking tables directly from the database.
 *
 * Usage:
 *   node src/db/migrations/00-populate-organization-internal-ids-db.js
 */

require("dotenv").config();
const { Client } = require("pg");

async function populateOrganizationInternalIds() {
  console.log("=== Populating organizationInternalId Fields (Direct DB) ===\n");

  const client = new Client({
    host: process.env.DATABASE_HOST || "localhost",
    port: parseInt(process.env.DATABASE_PORT || "5432"),
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD || "",
    database: process.env.DATABASE_NAME,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? {
            rejectUnauthorized:
              process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
          }
        : false,
  });

  try {
    await client.connect();
    console.log("✓ Connected to database\n");

    // Step 1: Build organization ID -> internalId map
    console.log("Step 1: Building organization mapping...");
    const orgResult = await client.query(
      "SELECT id, internal_id FROM organizations WHERE internal_id IS NOT NULL"
    );

    const orgMap = new Map();
    for (const row of orgResult.rows) {
      orgMap.set(row.id, row.internal_id);
    }

    console.log(`  ✓ Loaded ${orgMap.size} organizations\n`);

    // Step 2: Update organization_donations using linking table
    console.log("Step 2: Updating organization_donations...");

    const updateOrgDonationsQuery = `
      UPDATE organization_donations od
      SET organization_internal_id = o.internal_id
      FROM organization_donations_organization_links link
      JOIN organizations o ON o.id = link.organization_id
      WHERE od.id = link.organization_donation_id
        AND od.organization_internal_id IS NULL
        AND o.internal_id IS NOT NULL
    `;

    const orgDonationsResult = await client.query(updateOrgDonationsQuery);
    console.log(
      `  ✓ Updated ${orgDonationsResult.rowCount} organization donations\n`
    );

    // Step 3: Update organization_recurring_donations using linking table
    console.log("Step 3: Updating organization_recurring_donations...");

    const updateOrgRecurringQuery = `
      UPDATE organization_recurring_donations ord
      SET organization_internal_id = o.internal_id
      FROM organization_recurring_donations_organization_links link
      JOIN organizations o ON o.id = link.organization_id
      WHERE ord.id = link.organization_recurring_donation_id
        AND ord.organization_internal_id IS NULL
        AND o.internal_id IS NOT NULL
    `;

    const orgRecurringResult = await client.query(updateOrgRecurringQuery);
    console.log(
      `  ✓ Updated ${orgRecurringResult.rowCount} organization recurring donations\n`
    );

    // Step 4: Verification
    console.log("Step 4: Verification...");

    const nullOrgDonations = await client.query(
      "SELECT COUNT(*) FROM organization_donations WHERE organization_internal_id IS NULL"
    );

    const nullOrgRecurring = await client.query(
      "SELECT COUNT(*) FROM organization_recurring_donations WHERE organization_internal_id IS NULL"
    );

    console.log(
      `  Organization donations with null organizationInternalId: ${nullOrgDonations.rows[0].count}`
    );
    console.log(
      `  Organization recurring donations with null organizationInternalId: ${nullOrgRecurring.rows[0].count}`
    );

    if (
      nullOrgDonations.rows[0].count === "0" &&
      nullOrgRecurring.rows[0].count === "0"
    ) {
      console.log(
        "\n✓ All organizationInternalId fields populated successfully!\n"
      );
    } else {
      console.log("\n⚠ Some records still have null organizationInternalId\n");
    }
  } catch (error) {
    console.error("\n✗ Population failed!");
    console.error("Error:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

populateOrganizationInternalIds();
