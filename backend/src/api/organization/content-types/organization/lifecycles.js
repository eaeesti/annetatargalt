'use strict';

const { eq, sql } = require('drizzle-orm');

/**
 * Prevent deletion of an organization that has donation records in Drizzle.
 * Callers should deactivate the organization (set active=false) instead.
 */
async function guardAgainstDelete(internalId) {
  const { db } = require('../../../../db/client');
  const {
    organizationDonations,
    organizationRecurringDonations,
  } = require('../../../../db/schema');

  const [odResult] = await db
    .select({ count: sql`count(*)::int` })
    .from(organizationDonations)
    .where(eq(organizationDonations.organizationInternalId, internalId));

  if (odResult.count > 0) {
    throw new Error(
      `Cannot delete organization "${internalId}": it has ${odResult.count} donation(s) linked to it. Deactivate it instead.`
    );
  }

  const [ordResult] = await db
    .select({ count: sql`count(*)::int` })
    .from(organizationRecurringDonations)
    .where(
      eq(organizationRecurringDonations.organizationInternalId, internalId)
    );

  if (ordResult.count > 0) {
    throw new Error(
      `Cannot delete organization "${internalId}": it has ${ordResult.count} recurring donation(s) linked to it. Deactivate it instead.`
    );
  }
}

module.exports = {
  async beforeDelete(event) {
    const organization = await strapi.entityService.findOne(
      'api::organization.organization',
      event.params.where.id,
      { fields: ['internalId'] }
    );

    if (organization?.internalId) {
      await guardAgainstDelete(organization.internalId);
    }
  },

  async beforeDeleteMany(event) {
    const organizations = await strapi.entityService.findMany(
      'api::organization.organization',
      {
        filters: event.params.where,
        fields: ['internalId'],
      }
    );

    for (const org of organizations) {
      if (org.internalId) {
        await guardAgainstDelete(org.internalId);
      }
    }
  },
};
