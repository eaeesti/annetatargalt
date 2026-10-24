import type { Core } from "@strapi/strapi";

/**
 * The organization that receives donors' optional tip (Anneta Targalt
 * itself), from the site settings. A transfer round's card fees come off its
 * share. Null when it isn't configured, in which case nothing is deducted.
 */
export async function tipOrganizationInternalId(
  strapi: Core.Strapi,
): Promise<string | null> {
  const global = await strapi
    .documents("api::global.global")
    .findFirst({ fields: ["tipOrganizationInternalId"] });
  return global?.tipOrganizationInternalId || null;
}
