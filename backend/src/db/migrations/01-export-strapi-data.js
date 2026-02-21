/**
 * Step 1: Export all donation data from Strapi
 *
 * This script calls the existing /donations/export endpoint
 * and saves the data to a JSON file for backup and migration.
 *
 * Usage:
 *   1. Make sure Strapi is running (yarn develop in backend/)
 *   2. Run: node src/db/migrations/01-export-strapi-data.js
 */

const fs = require("fs");
const path = require("path");

// Configuration
const STRAPI_URL = process.env.STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
const OUTPUT_DIR = path.join(__dirname, "exported-data");
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
const OUTPUT_FILE = path.join(OUTPUT_DIR, `strapi-export-${TIMESTAMP}.json`);

// Validate API token
if (!STRAPI_API_TOKEN) {
  console.error("✗ Error: STRAPI_API_TOKEN environment variable is required");
  console.error("\nTo create an API token:");
  console.error("  1. Go to Strapi admin panel (http://localhost:1337/admin)");
  console.error("  2. Navigate to Settings > API Tokens");
  console.error(
    '  3. Create a new token with "Full access" or "Custom" with read permissions'
  );
  console.error("  4. Copy the token and set it as an environment variable");
  console.error("\nUsage:");
  console.error(
    "  STRAPI_API_TOKEN=your-token-here node src/db/migrations/01-export-strapi-data.js"
  );
  process.exit(1);
}

async function exportData() {
  console.log("=== Strapi Data Export ===\n");
  console.log(`Fetching data from: ${STRAPI_URL}/api/donations/export`);

  try {
    // Fetch data from Strapi with API token authentication
    const response = await fetch(`${STRAPI_URL}/api/donations/export`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Save to JSON file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));

    // Print statistics
    console.log("\n✓ Data exported successfully!\n");
    console.log("Statistics:");
    console.log(`  - Causes: ${data.causes?.length || 0}`);
    console.log(`  - Organizations: ${data.organizations?.length || 0}`);
    console.log(`  - Donors: ${data.donors?.length || 0}`);
    console.log(
      `  - Recurring Donations: ${data.recurringDonations?.length || 0}`
    );
    console.log(
      `  - Org Recurring Donations: ${
        data.organizationRecurringDonations?.length || 0
      }`
    );
    console.log(`  - Donations: ${data.donations?.length || 0}`);
    console.log(
      `  - Organization Donations: ${data.organizationDonations?.length || 0}`
    );
    console.log(
      `  - Donation Transfers: ${data.donationTransfers?.length || 0}`
    );
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
    console.error("  1. Strapi is running (yarn develop in backend/)");
    console.error(
      `  2. The endpoint is accessible at ${STRAPI_URL}/api/donations/export`
    );
    process.exit(1);
  }
}

// Run the export
exportData();
