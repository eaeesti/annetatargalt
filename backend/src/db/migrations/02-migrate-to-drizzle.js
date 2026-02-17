/**
 * Step 2: Migrate data from Strapi export to Drizzle database
 *
 * This script:
 * 1. Reads the exported Strapi data
 * 2. Builds organization ID mapping (numeric → internalId)
 * 3. Transforms data to Drizzle format
 * 4. Inserts data into Drizzle database
 * 5. Validates the migration
 *
 * Usage:
 *   node src/db/migrations/02-migrate-to-drizzle.js
 */

'use strict';

// Load environment variables
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool, closeDatabase } = require('../client');
const {
  donorsRepository,
  donationsRepository,
  recurringDonationsRepository,
  organizationDonationsRepository,
  organizationRecurringDonationsRepository,
  donationTransfersRepository,
} = require('../repositories');

// Find the latest export file
function findLatestExport() {
  const exportDir = path.join(__dirname, 'exported-data');
  const files = fs.readdirSync(exportDir).filter(f => f.startsWith('strapi-export-'));

  if (files.length === 0) {
    throw new Error('No export files found. Run 01-export-strapi-data.js first.');
  }

  // Sort by filename (date) descending
  files.sort().reverse();
  return path.join(exportDir, files[0]);
}

// Build mapping of organization numeric ID → internalId
function buildOrganizationMapping(organizations) {
  const mapping = new Map();

  for (const org of organizations) {
    if (!org.internalId) {
      throw new Error(`Organization ID ${org.id} ("${org.title}") is missing internalId!`);
    }
    mapping.set(org.id, org.internalId);
  }

  return mapping;
}

async function migrate() {
  console.log('=== Drizzle Migration ===\n');

  try {
    // Step 1: Load exported data
    console.log('Step 1: Loading exported data...');
    const exportFile = findLatestExport();
    console.log(`  Reading: ${exportFile}`);

    const data = JSON.parse(fs.readFileSync(exportFile, 'utf-8'));

    console.log('  Statistics:');
    console.log(`    - Donors: ${data.donors.length}`);
    console.log(`    - Donations: ${data.donations.length}`);
    console.log(`    - Organization Donations: ${data.organizationDonations.length}`);
    console.log(`    - Recurring Donations: ${data.recurringDonations.length}`);
    console.log(`    - Org Recurring Donations: ${data.organizationRecurringDonations.length}`);
    console.log(`    - Donation Transfers: ${data.donationTransfers.length}\n`);

    // Step 2: Build organization mapping
    console.log('Step 2: Building organization mapping...');
    const orgMapping = buildOrganizationMapping(data.organizations);
    console.log(`  ✓ Mapped ${orgMapping.size} organizations\n`);

    // Step 3: Validate and fix organizationInternalId values
    console.log('Step 3: Validating organization references...');
    let fixedOrgDonations = 0;
    let fixedOrgRecurringDonations = 0;

    // Skip records with null organizationInternalId or null donation reference
    const validOrgDonations = data.organizationDonations.filter(od => {
      if (!od.organizationInternalId) {
        fixedOrgDonations++;
        return false;
      }
      if (!od.donation) {
        fixedOrgDonations++;
        return false;
      }
      return true;
    });

    const validOrgRecurringDonations = data.organizationRecurringDonations.filter(ord => {
      if (!ord.organizationInternalId) {
        fixedOrgRecurringDonations++;
        return false;
      }
      if (!ord.recurringDonation) {
        fixedOrgRecurringDonations++;
        return false;
      }
      return true;
    });

    if (fixedOrgDonations > 0 || fixedOrgRecurringDonations > 0) {
      console.log(`  ⚠ Warning: Skipping ${fixedOrgDonations} organization donations and ${fixedOrgRecurringDonations} org recurring donations (null references)`);
    }
    console.log(`  ✓ Validated references (${validOrgDonations.length} org donations, ${validOrgRecurringDonations.length} org recurring donations)\n`);

    // Step 4: Migrate donors
    console.log('Step 4: Migrating donors...');
    const donorIdMapping = new Map();

    for (const strapiDonor of data.donors) {
      const drizzleDonor = await donorsRepository.create({
        idCode: strapiDonor.idCode || null,
        firstName: strapiDonor.firstName,
        lastName: strapiDonor.lastName,
        email: strapiDonor.email,
        recurringDonor: strapiDonor.recurringDonor || false,
      });

      donorIdMapping.set(strapiDonor.id, drizzleDonor.id);
    }
    console.log(`  ✓ Migrated ${donorIdMapping.size} donors\n`);

    // Step 5: Migrate donation transfers
    console.log('Step 5: Migrating donation transfers...');
    const transferIdMapping = new Map();

    for (const strapiTransfer of data.donationTransfers) {
      const drizzleTransfer = await donationTransfersRepository.create({
        datetime: strapiTransfer.datetime.split('T')[0], // Convert to YYYY-MM-DD
        recipient: strapiTransfer.recipient,
        notes: strapiTransfer.notes,
      });

      transferIdMapping.set(strapiTransfer.id, drizzleTransfer.id);
    }
    console.log(`  ✓ Migrated ${transferIdMapping.size} donation transfers\n`);

    // Step 6: Migrate recurring donations
    console.log('Step 6: Migrating recurring donations...');
    const recurringDonationIdMapping = new Map();

    for (const strapiRecurring of data.recurringDonations) {
      const drizzleRecurring = await recurringDonationsRepository.create({
        donorId: donorIdMapping.get(strapiRecurring.donor),
        active: strapiRecurring.active ?? false,
        companyName: strapiRecurring.companyName,
        companyCode: strapiRecurring.companyCode,
        comment: strapiRecurring.comment,
        bank: strapiRecurring.bank,
        amount: strapiRecurring.amount,
        datetime: new Date(strapiRecurring.datetime),
      });

      recurringDonationIdMapping.set(strapiRecurring.id, drizzleRecurring.id);
    }
    console.log(`  ✓ Migrated ${recurringDonationIdMapping.size} recurring donations\n`);

    // Step 7: Migrate organization recurring donations
    console.log('Step 7: Migrating organization recurring donations...');

    for (const strapiOrgRecurring of validOrgRecurringDonations) {
      await organizationRecurringDonationsRepository.create({
        recurringDonationId: recurringDonationIdMapping.get(strapiOrgRecurring.recurringDonation),
        organizationInternalId: strapiOrgRecurring.organizationInternalId,
        amount: strapiOrgRecurring.amount,
      });
    }
    console.log(`  ✓ Migrated ${validOrgRecurringDonations.length} organization recurring donations\n`);

    // Step 8: Migrate donations
    console.log('Step 8: Migrating donations...');
    const donationIdMapping = new Map();

    for (const strapiDonation of data.donations) {
      const drizzleDonation = await donationsRepository.create({
        donorId: strapiDonation.donor ? donorIdMapping.get(strapiDonation.donor) : null,
        recurringDonationId: strapiDonation.recurringDonation
          ? recurringDonationIdMapping.get(strapiDonation.recurringDonation)
          : null,
        donationTransferId: strapiDonation.donationTransfer
          ? transferIdMapping.get(strapiDonation.donationTransfer)
          : null,
        datetime: new Date(strapiDonation.datetime),
        amount: strapiDonation.amount,
        finalized: strapiDonation.finalized,
        paymentMethod: strapiDonation.paymentMethod,
        iban: strapiDonation.iban,
        comment: strapiDonation.comment,
        companyName: strapiDonation.companyName,
        companyCode: strapiDonation.companyCode,
        sentToOrganization: strapiDonation.sentToOrganization,
        dedicationName: strapiDonation.dedicationName,
        dedicationEmail: strapiDonation.dedicationEmail,
        dedicationMessage: strapiDonation.dedicationMessage,
        externalDonation: strapiDonation.externalDonation ?? false,
      });

      donationIdMapping.set(strapiDonation.id, drizzleDonation.id);
    }
    console.log(`  ✓ Migrated ${donationIdMapping.size} donations\n`);

    // Step 9: Migrate organization donations
    console.log('Step 9: Migrating organization donations...');

    for (const strapiOrgDonation of validOrgDonations) {
      await organizationDonationsRepository.create({
        donationId: donationIdMapping.get(strapiOrgDonation.donation),
        organizationInternalId: strapiOrgDonation.organizationInternalId,
        amount: strapiOrgDonation.amount,
      });
    }
    console.log(`  ✓ Migrated ${validOrgDonations.length} organization donations\n`);

    // Step 10: Validation
    console.log('Step 10: Validating migration...');

    const donorCount = await pool.query('SELECT COUNT(*) FROM donors');
    const donationCount = await pool.query('SELECT COUNT(*) FROM donations');
    const orgDonationCount = await pool.query('SELECT COUNT(*) FROM organization_donations');
    const recurringDonationCount = await pool.query('SELECT COUNT(*) FROM recurring_donations');
    const orgRecurringDonationCount = await pool.query('SELECT COUNT(*) FROM organization_recurring_donations');
    const transferCount = await pool.query('SELECT COUNT(*) FROM donation_transfers');

    console.log('  Row counts:');
    console.log(`    - Donors: ${donorCount.rows[0].count} (expected: ${data.donors.length})`);
    console.log(`    - Donations: ${donationCount.rows[0].count} (expected: ${data.donations.length})`);
    console.log(`    - Organization Donations: ${orgDonationCount.rows[0].count} (expected: ${validOrgDonations.length})`);
    console.log(`    - Recurring Donations: ${recurringDonationCount.rows[0].count} (expected: ${data.recurringDonations.length})`);
    console.log(`    - Org Recurring Donations: ${orgRecurringDonationCount.rows[0].count} (expected: ${validOrgRecurringDonations.length})`);
    console.log(`    - Donation Transfers: ${transferCount.rows[0].count} (expected: ${data.donationTransfers.length})`);

    // Validate donation amounts sum
    const strapiTotalAmount = data.donations.reduce((sum, d) => sum + d.amount, 0);
    const drizzleTotalAmount = await pool.query('SELECT SUM(amount) as total FROM donations');

    console.log('\n  Amount validation:');
    console.log(`    - Strapi total: €${(strapiTotalAmount / 100).toFixed(2)}`);
    console.log(`    - Drizzle total: €${(parseInt(drizzleTotalAmount.rows[0].total) / 100).toFixed(2)}`);

    if (strapiTotalAmount === parseInt(drizzleTotalAmount.rows[0].total)) {
      console.log('    ✓ Amounts match!');
    } else {
      console.error('    ✗ WARNING: Amounts do not match!');
    }

    console.log('\n✓ Migration complete!\n');

  } catch (error) {
    console.error('\n✗ Migration failed!');
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run the migration
migrate();
