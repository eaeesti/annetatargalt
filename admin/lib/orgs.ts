import { strapiAdmin } from "./api";

export type StrapiOrg = {
  id: number;
  documentId: string;
  title: string | null;
  internalId: string;
  homepage: string | null;
  active: boolean;
  fund: boolean;
  logo: { url: string; alternativeText: string | null } | null;
};

type StrapiOrgsResponse = {
  data: StrapiOrg[];
};

/**
 * Fetches all organizations from Strapi using the admin JWT.
 * pageSize=500 overrides Strapi's default 25-result cap (pagination[limit]=-1 is not supported in v5).
 */
export async function fetchOrgs(): Promise<StrapiOrg[]> {
  const res = await strapiAdmin(
    "/api/organizations?populate=logo&pagination[pageSize]=500",
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const json = (await res.json()) as StrapiOrgsResponse;
  return json.data ?? [];
}

/**
 * Returns a map of internalId → display title.
 * Falls back to the raw internalId if an org isn't found.
 */
export async function resolveOrgNames(
  internalIds: string[]
): Promise<Map<string, string>> {
  if (internalIds.length === 0) return new Map();
  const orgs = await fetchOrgs();
  const map = new Map<string, string>();
  for (const org of orgs) {
    map.set(org.internalId, org.title ?? org.internalId);
  }
  // Ensure every requested id has an entry (fallback to raw id)
  for (const id of internalIds) {
    if (!map.has(id)) map.set(id, id);
  }
  return map;
}
