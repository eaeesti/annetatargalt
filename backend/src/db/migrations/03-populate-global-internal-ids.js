/**
 * Migration: Populate tipOrganizationInternalId and externalOrganizationInternalId
 *
 * This migration populates the new internalId fields in the global config
 * by looking up the organizations referenced by the numeric IDs.
 *
 * Run this via: node backend/src/db/migrations/03-populate-global-internal-ids.js
 * Or via Strapi console (recommended)
 */

async function migrateGlobalInternalIds(strapi) {
  console.log('Starting global config internalId population...');

  // Get current global config
  const global = await strapi.db.query('api::global.global').findOne();

  if (!global) {
    console.error('Error: Global config not found');
    return false;
  }

  console.log('Current global config:');
  console.log(`  tipOrganizationId: ${global.tipOrganizationId}`);
  console.log(`  externalOrganizationId: ${global.externalOrganizationId}`);
  console.log(`  tipOrganizationInternalId: ${global.tipOrganizationInternalId || '(not set)'}`);
  console.log(`  externalOrganizationInternalId: ${global.externalOrganizationInternalId || '(not set)'}`);

  const updates = {};

  // Populate tipOrganizationInternalId
  if (global.tipOrganizationId && !global.tipOrganizationInternalId) {
    const tipOrg = await strapi.entityService.findOne(
      'api::organization.organization',
      global.tipOrganizationId,
      { fields: ['internalId', 'title'] }
    );

    if (tipOrg && tipOrg.internalId) {
      updates.tipOrganizationInternalId = tipOrg.internalId;
      console.log(`\nFound tip organization (ID ${global.tipOrganizationId}):`);
      console.log(`  Title: ${tipOrg.title}`);
      console.log(`  InternalId: ${tipOrg.internalId}`);
    } else {
      console.warn(`Warning: Could not find organization with ID ${global.tipOrganizationId}`);
    }
  } else if (global.tipOrganizationInternalId) {
    console.log('\ntipOrganizationInternalId already set, skipping');
  } else {
    console.log('\ntipOrganizationId not set, skipping');
  }

  // Populate externalOrganizationInternalId
  if (global.externalOrganizationId && !global.externalOrganizationInternalId) {
    const extOrg = await strapi.entityService.findOne(
      'api::organization.organization',
      global.externalOrganizationId,
      { fields: ['internalId', 'title'] }
    );

    if (extOrg && extOrg.internalId) {
      updates.externalOrganizationInternalId = extOrg.internalId;
      console.log(`\nFound external organization (ID ${global.externalOrganizationId}):`);
      console.log(`  Title: ${extOrg.title}`);
      console.log(`  InternalId: ${extOrg.internalId}`);
    } else {
      console.warn(`Warning: Could not find organization with ID ${global.externalOrganizationId}`);
    }
  } else if (global.externalOrganizationInternalId) {
    console.log('\nexternalOrganizationInternalId already set, skipping');
  } else {
    console.log('\nexternalOrganizationId not set, skipping');
  }

  // Update global config if we have changes
  if (Object.keys(updates).length > 0) {
    console.log('\nUpdating global config with:');
    console.log(JSON.stringify(updates, null, 2));

    await strapi.db.query('api::global.global').update({
      where: { id: global.id },
      data: updates,
    });

    console.log('\n✅ Global config updated successfully!');
    return true;
  } else {
    console.log('\n✅ No updates needed - all internalId fields already populated');
    return true;
  }
}

// For standalone execution (not recommended - use Strapi console instead)
if (require.main === module) {
  console.log('⚠️  This script should be run via Strapi console for proper initialization');
  console.log('⚠️  Run: yarn strapi console');
  console.log('⚠️  Then: const migrate = require("./src/db/migrations/03-populate-global-internal-ids"); await migrate(strapi);');
  process.exit(1);
}

module.exports = migrateGlobalInternalIds;
