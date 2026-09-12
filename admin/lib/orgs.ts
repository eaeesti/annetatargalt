import { cache } from "react";
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
 * The org list is small, identical for every admin, and changes on the order of
 * months — but it was being refetched (with logo media populated) on every
 * single page view. Cached two ways:
 *
 * - `next.revalidate` keeps it in the Data Cache across requests, so most
 *   navigations skip the Strapi round trip entirely.
 * - `cache()` dedupes it within a single render, so a page that needs org
 *   names in two places still only fetches once.
 *
 * Nothing here is user-scoped, so a shared cache entry can't leak anything —
 * the JWT only authorizes the call, it doesn't filter the results.
 */
const ORGS_REVALIDATE_SECONDS = 300;

export const fetchOrgs = cache(async (): Promise<StrapiOrg[]> => {
  const res = await strapiAdmin(
    "/api/organizations?populate=logo&pagination[pageSize]=500",
    { next: { revalidate: ORGS_REVALIDATE_SECONDS } },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as StrapiOrgsResponse;
  return json.data ?? [];
});

/**
 * internalId → display title, for the whole org list.
 *
 * Callers already fall back to the raw internalId for anything missing
 * (`orgNames.get(id) ?? id`), so this takes no ids and can be started in
 * parallel with whatever fetch produces them — it never had to wait for them.
 */
export const fetchOrgNameMap = cache(async (): Promise<Map<string, string>> => {
  const orgs = await fetchOrgs();
  return new Map(
    orgs.map((org) => [org.internalId, org.title ?? org.internalId]),
  );
});
