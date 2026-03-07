import { eq, sql } from "drizzle-orm";
import { db } from "../../../../db/client";
import {
  organizationDonations,
  organizationRecurringDonations,
} from "../../../../db/schema";

/**
 * Prevent deletion of an organization that has donation records in Drizzle.
 * Callers should deactivate the organization (set active=false) instead.
 */
async function guardAgainstDelete(internalId: string): Promise<void> {
  const [odResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organizationDonations)
    .where(eq(organizationDonations.organizationInternalId, internalId));

  if (odResult.count > 0) {
    throw new Error(
      `Cannot delete organization "${internalId}": it has ${odResult.count} donation(s) linked to it. Deactivate it instead.`
    );
  }

  const [ordResult] = await db
    .select({ count: sql<number>`count(*)::int` })
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

interface LifecycleEvent {
  params: { where: Record<string, unknown> };
}

export default {
  async beforeDelete(event: LifecycleEvent) {
    const organization = await strapi
      .documents("api::organization.organization")
      .findOne({
        documentId: (event.params.where.documentId || event.params.where.id) as string,
        fields: ["internalId"],
      });

    if (organization?.internalId) {
      await guardAgainstDelete(organization.internalId);
    }
  },

  async beforeDeleteMany(event: LifecycleEvent) {
    const organizations = await strapi
      .documents("api::organization.organization")
      .findMany({
        filters: event.params.where as Record<string, unknown>,
        fields: ["internalId"],
      });

    for (const org of organizations) {
      if (org.internalId) {
        await guardAgainstDelete(org.internalId);
      }
    }
  },
};
