import { eq, sql } from "drizzle-orm";
import { db } from "../../../../db/client";
import { strapiTable } from "../../../../strapi-internals";
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
      `Cannot delete organization "${internalId}": it has ${odResult.count} donation(s) linked to it. Deactivate it instead.`,
    );
  }

  const [ordResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organizationRecurringDonations)
    .where(
      eq(organizationRecurringDonations.organizationInternalId, internalId),
    );

  if (ordResult.count > 0) {
    throw new Error(
      `Cannot delete organization "${internalId}": it has ${ordResult.count} recurring donation(s) linked to it. Deactivate it instead.`,
    );
  }
}

interface LifecycleEvent {
  params: { where: Record<string, unknown> };
}

/**
 * The organization rows a delete is about to remove. A lifecycle's `where`
 * is the database's own (usually a row id), so the rows are looked up in the
 * database too.
 */
function organizationsBeingDeleted(event: LifecycleEvent) {
  return strapiTable<{ internalId: string | null }>(
    strapi,
    "api::organization.organization",
  ).findMany({ where: event.params.where, select: ["internalId"] });
}

export default {
  async beforeDelete(event: LifecycleEvent) {
    for (const organization of await organizationsBeingDeleted(event)) {
      if (organization.internalId) {
        await guardAgainstDelete(organization.internalId);
      }
    }
  },

  async beforeDeleteMany(event: LifecycleEvent) {
    for (const organization of await organizationsBeingDeleted(event)) {
      if (organization.internalId) {
        await guardAgainstDelete(organization.internalId);
      }
    }
  },
};
