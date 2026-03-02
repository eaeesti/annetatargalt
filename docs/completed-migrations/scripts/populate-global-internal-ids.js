#!/usr/bin/env node
/**
 * Standalone script to populate global config internalId fields
 *
 * Usage: node backend/scripts/populate-global-internal-ids.js
 */

const Strapi = require('@strapi/strapi');

async function main() {
  console.log('Bootstrapping Strapi...');

  const strapi = await Strapi().load();

  console.log('Strapi loaded successfully\n');
  console.log('='.repeat(60));

  try {
    // Get current global config
    const global = await strapi.db.query('api::global.global').findOne();

    if (!global) {
      console.error('Error: Global config not found');
      process.exit(1);
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
        console.warn(`\n⚠️  Warning: Could not find organization with ID ${global.tipOrganizationId}`);
      }
    } else if (global.tipOrganizationInternalId) {
      console.log('\n✅ tipOrganizationInternalId already set: ' + global.tipOrganizationInternalId);
    } else {
      console.log('\nℹ️  tipOrganizationId not set, skipping');
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
        console.warn(`\n⚠️  Warning: Could not find organization with ID ${global.externalOrganizationId}`);
      }
    } else if (global.externalOrganizationInternalId) {
      console.log('\n✅ externalOrganizationInternalId already set: ' + global.externalOrganizationInternalId);
    } else {
      console.log('\nℹ️  externalOrganizationId not set, skipping');
    }

    // Update global config if we have changes
    if (Object.keys(updates).length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('Updating global config with:');
      console.log(JSON.stringify(updates, null, 2));
      console.log('='.repeat(60));

      await strapi.db.query('api::global.global').update({
        where: { id: global.id },
        data: updates,
      });

      console.log('\n✅ Global config updated successfully!\n');

      // Verify the update
      const updatedGlobal = await strapi.db.query('api::global.global').findOne();
      console.log('Updated values:');
      console.log(`  tipOrganizationInternalId: ${updatedGlobal.tipOrganizationInternalId || '(not set)'}`);
      console.log(`  externalOrganizationInternalId: ${updatedGlobal.externalOrganizationInternalId || '(not set)'}`);
    } else {
      console.log('\n' + '='.repeat(60));
      console.log('✅ No updates needed - all internalId fields already populated');
      console.log('='.repeat(60));
    }

    await strapi.destroy();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during migration:', error);
    await strapi.destroy();
    process.exit(1);
  }
}

main();
