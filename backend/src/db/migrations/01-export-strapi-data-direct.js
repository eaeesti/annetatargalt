/**
 * Step 1: Export all donation data DIRECTLY from Strapi database
 *
 * This script queries the Strapi PostgreSQL database directly to export data,
 * bypassing the API endpoint which may have already been migrated to Drizzle.
 *
 * Usage:
 *   1. Set STRAPI_DATABASE_NAME environment variable
 *   2. Run: node src/db/migrations/01-export-strapi-data-direct.js
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// Configuration for STRAPI database (not Drizzle!)
const STRAPI_DB_HOST = process.env.DATABASE_HOST || "localhost";
const STRAPI_DB_PORT = parseInt(process.env.DATABASE_PORT || "5432");
const STRAPI_DB_USER = process.env.DATABASE_USERNAME || "strapi";
const STRAPI_DB_PASSWORD = process.env.DATABASE_PASSWORD || "strapi";
const STRAPI_DB_NAME =
  process.env.STRAPI_DATABASE_NAME || "annetatargalt"; // NOT the drizzle DB!

const OUTPUT_DIR = path.join(__dirname, "exported-data");
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
const OUTPUT_FILE = path.join(OUTPUT_DIR, `strapi-export-${TIMESTAMP}.json`);

// Create database pool for STRAPI database
const pool = new Pool({
  host: STRAPI_DB_HOST,
  port: STRAPI_DB_PORT,
  user: STRAPI_DB_USER,
  password: STRAPI_DB_PASSWORD,
  database: STRAPI_DB_NAME,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? {
          rejectUnauthorized:
            process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
        }
      : false,
});

async function exportData() {
  console.log("=== Strapi Direct Database Export ===\n");
  console.log(`Database: ${STRAPI_DB_NAME} @ ${STRAPI_DB_HOST}:${STRAPI_DB_PORT}`);

  try {
    // Test connection
    await pool.query("SELECT 1");
    console.log("✓ Connected to Strapi database\n");

    const data = {};

    // Export causes
    console.log("Exporting causes...");
    const causesResult = await pool.query(
      "SELECT id, title, slug, created_at, updated_at FROM causes ORDER BY id"
    );
    data.causes = causesResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    console.log(`  ✓ Exported ${data.causes.length} causes`);

    // Export organizations
    console.log("Exporting organizations...");
    const orgsResult = await pool.query(`
      SELECT o.id, o.title, o.slug, o.internal_id, o.created_at, o.updated_at
      FROM organizations o
      ORDER BY o.id
    `);
    data.organizations = orgsResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      internalId: row.internal_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    console.log(`  ✓ Exported ${data.organizations.length} organizations`);

    // Export donors
    console.log("Exporting donors...");
    const donorsResult = await pool.query(`
      SELECT id, id_code, first_name, last_name, email, recurring_donor, created_at, updated_at
      FROM donors
      ORDER BY id
    `);
    data.donors = donorsResult.rows.map((row) => ({
      id: row.id,
      idCode: row.id_code,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      recurringDonor: row.recurring_donor,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    console.log(`  ✓ Exported ${data.donors.length} donors`);

    // Export donation transfers
    console.log("Exporting donation transfers...");
    const transfersResult = await pool.query(`
      SELECT id, datetime, recipient, notes, created_at, updated_at
      FROM donation_transfers
      ORDER BY id
    `);
    data.donationTransfers = transfersResult.rows.map((row) => ({
      id: row.id,
      datetime: row.datetime,
      recipient: row.recipient,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    console.log(`  ✓ Exported ${data.donationTransfers.length} donation transfers`);

    // Export recurring donations
    console.log("Exporting recurring donations...");
    const recurringResult = await pool.query(`
      SELECT
        rd.id,
        rdl.donor_id as donor,
        rd.active,
        rd.company_name,
        rd.company_code,
        rd.comment,
        rd.bank,
        rd.amount,
        rd.datetime,
        rd.created_at,
        rd.updated_at
      FROM recurring_donations rd
      LEFT JOIN recurring_donations_donor_links rdl ON rdl.recurring_donation_id = rd.id
      ORDER BY rd.id
    `);
    data.recurringDonations = recurringResult.rows.map((row) => ({
      id: row.id,
      donor: row.donor,
      active: row.active,
      companyName: row.company_name,
      companyCode: row.company_code,
      comment: row.comment,
      bank: row.bank,
      amount: row.amount,
      datetime: row.datetime,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    console.log(
      `  ✓ Exported ${data.recurringDonations.length} recurring donations`
    );

    // Export organization recurring donations
    console.log("Exporting organization recurring donations...");
    const orgRecurringResult = await pool.query(`
      SELECT
        ord.id,
        ordl.recurring_donation_id as recurring_donation,
        ord.organization_internal_id,
        ord.amount,
        ord.created_at,
        ord.updated_at
      FROM organization_recurring_donations ord
      LEFT JOIN organization_recurring_donations_recurring_donation_links ordl
        ON ordl.organization_recurring_donation_id = ord.id
      ORDER BY ord.id
    `);
    data.organizationRecurringDonations = orgRecurringResult.rows.map(
      (row) => ({
        id: row.id,
        recurringDonation: row.recurring_donation,
        organizationInternalId: row.organization_internal_id,
        amount: row.amount,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })
    );
    console.log(
      `  ✓ Exported ${data.organizationRecurringDonations.length} organization recurring donations`
    );

    // Export donations
    console.log("Exporting donations...");
    const donationsResult = await pool.query(`
      SELECT
        d.id,
        dl_donor.donor_id as donor,
        dl_recurring.recurring_donation_id as recurring_donation,
        dl_transfer.donation_transfer_id as donation_transfer,
        d.datetime,
        d.amount,
        d.finalized,
        d.payment_method,
        d.iban,
        d.comment,
        d.company_name,
        d.company_code,
        d.sent_to_organization,
        d.dedication_name,
        d.dedication_email,
        d.dedication_message,
        d.external_donation,
        d.created_at,
        d.updated_at
      FROM donations d
      LEFT JOIN donations_donor_links dl_donor ON dl_donor.donation_id = d.id
      LEFT JOIN donations_recurring_donation_links dl_recurring ON dl_recurring.donation_id = d.id
      LEFT JOIN donations_donation_transfer_links dl_transfer ON dl_transfer.donation_id = d.id
      ORDER BY d.id
    `);
    data.donations = donationsResult.rows.map((row) => ({
      id: row.id,
      donor: row.donor,
      recurringDonation: row.recurring_donation,
      donationTransfer: row.donation_transfer,
      datetime: row.datetime,
      amount: row.amount,
      finalized: row.finalized,
      paymentMethod: row.payment_method,
      iban: row.iban,
      comment: row.comment,
      companyName: row.company_name,
      companyCode: row.company_code,
      sentToOrganization: row.sent_to_organization,
      dedicationName: row.dedication_name,
      dedicationEmail: row.dedication_email,
      dedicationMessage: row.dedication_message,
      externalDonation: row.external_donation,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    console.log(`  ✓ Exported ${data.donations.length} donations`);

    // Export organization donations
    console.log("Exporting organization donations...");
    const orgDonationsResult = await pool.query(`
      SELECT
        od.id,
        odl.donation_id as donation,
        od.organization_internal_id,
        od.amount,
        od.created_at,
        od.updated_at
      FROM organization_donations od
      LEFT JOIN organization_donations_donation_links odl ON odl.organization_donation_id = od.id
      ORDER BY od.id
    `);
    data.organizationDonations = orgDonationsResult.rows.map((row) => ({
      id: row.id,
      donation: row.donation,
      organizationInternalId: row.organization_internal_id,
      amount: row.amount,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    console.log(
      `  ✓ Exported ${data.organizationDonations.length} organization donations`
    );

    // Validate we actually got data
    console.log("\nValidating export...");
    if (data.donors.length === 0) {
      throw new Error(
        "✗ No donors found in database! Check that STRAPI_DATABASE_NAME is correct."
      );
    }
    if (data.donations.length === 0) {
      throw new Error(
        "✗ No donations found in database! Check that STRAPI_DATABASE_NAME is correct."
      );
    }
    if (data.organizations.length === 0) {
      throw new Error(
        "✗ No organizations found in database! Check that STRAPI_DATABASE_NAME is correct."
      );
    }
    console.log("✓ Export contains data\n");

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Save to JSON file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));

    // Print statistics
    console.log("\n✓ Data exported successfully!\n");
    console.log("Statistics:");
    console.log(`  - Causes: ${data.causes.length}`);
    console.log(`  - Organizations: ${data.organizations.length}`);
    console.log(`  - Donors: ${data.donors.length}`);
    console.log(`  - Recurring Donations: ${data.recurringDonations.length}`);
    console.log(
      `  - Org Recurring Donations: ${data.organizationRecurringDonations.length}`
    );
    console.log(`  - Donations: ${data.donations.length}`);
    console.log(
      `  - Organization Donations: ${data.organizationDonations.length}`
    );
    console.log(`  - Donation Transfers: ${data.donationTransfers.length}`);
    console.log(`\n✓ Saved to: ${OUTPUT_FILE}`);

    // Validation checks
    console.log("\nValidation:");

    // Check if organizations have internalId
    const orgsWithoutInternalId = data.organizations.filter(
      (org) => !org.internalId
    );
    if (orgsWithoutInternalId.length > 0) {
      console.error(
        `  ✗ WARNING: ${orgsWithoutInternalId.length} organizations missing internalId!`
      );
      console.error(
        "    Organizations:",
        orgsWithoutInternalId.map((o) => `ID ${o.id}: "${o.title}"`).join(", ")
      );
    } else {
      console.log("  ✓ All organizations have internalId");
    }

    // Check for duplicate internalIds
    const internalIds = data.organizations
      .map((org) => org.internalId)
      .filter(Boolean);
    const duplicates = internalIds.filter(
      (id, index) => internalIds.indexOf(id) !== index
    );
    if (duplicates.length > 0) {
      console.error(
        `  ✗ WARNING: Duplicate internalIds found: ${[
          ...new Set(duplicates),
        ].join(", ")}`
      );
    } else {
      console.log("  ✓ No duplicate internalIds");
    }

    // Verify organization references in organizationDonations
    const orgDonationRefs = new Set(
      data.organizationDonations
        .map((od) => od.organizationInternalId)
        .filter(Boolean)
    );

    const validInternalIds = new Set(internalIds);
    const invalidRefs = [...orgDonationRefs].filter(
      (ref) => !validInternalIds.has(ref)
    );

    if (invalidRefs.length > 0) {
      console.error(
        `  ✗ WARNING: organizationDonations reference non-existent internalIds: ${invalidRefs.join(
          ", "
        )}`
      );
    } else {
      console.log(
        "  ✓ All organizationDonations reference valid organizations"
      );
    }

    console.log("\nExport complete! Ready for migration.");
  } catch (error) {
    console.error("\n✗ Export failed!");
    console.error("Error:", error.message);
    console.error("\nMake sure:");
    console.error(`  1. Strapi database exists: ${STRAPI_DB_NAME}`);
    console.error("  2. Database credentials are correct");
    console.error("  3. Database tables exist (donors, donations, etc.)");
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the export
exportData();
