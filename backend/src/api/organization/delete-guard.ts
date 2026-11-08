import type { Core } from "@strapi/strapi";
import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { strapiTable } from "../../strapi-internals";
import {
  organizationDonations,
  organizationRecurringDonations,
} from "../../db/schema";

const UID = "api::organization.organization";

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

/**
 * Refuses to delete an organization that donations went to. It watches the
 * document's delete rather than the database's: publishing replaces the
 * published row, and unpublishing removes it, and neither loses anything.
 */
export function guardOrganizationDeletes(strapi: Core.Strapi): void {
  strapi.documents.use(async (context, next) => {
    if (
      context.uid === UID &&
      context.action === "delete" &&
      "documentId" in context.params &&
      typeof context.params.documentId === "string"
    ) {
      // internalId isn't translated, so every row of the document has it.
      const rows = await strapiTable<{ internalId: string | null }>(
        strapi,
        UID,
      ).findMany({
        where: { documentId: context.params.documentId },
        select: ["internalId"],
      });
      for (const internalId of new Set(rows.map((row) => row.internalId))) {
        if (internalId) await guardAgainstDelete(internalId);
      }
    }
    return next();
  });
}
