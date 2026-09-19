import { strapiAdmin } from "../../../lib/api";
import { fetchOrgs } from "../../../lib/orgs";
import {
  OrganizationsTable,
  type OrganizationRow,
} from "./_components/organizations-table";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";

type OrgStat = {
  organizationInternalId: string;
  totalDonated: number;
  donationCount: number;
  lastDonationDate: string | null;
};

// Strapi media paths are relative, and STRAPI_URL is server-only, so this has
// to be resolved here rather than in the table component.
function logoUrl(url: string): string {
  return url.startsWith("http") ? url : `${STRAPI_URL}${url}`;
}

export default async function OrganizationsPage() {
  const [orgs, statsRes] = await Promise.all([
    fetchOrgs(),
    strapiAdmin("/api/admin-panel/organizations/stats", { cache: "no-store" }),
  ]);

  const statsMap = new Map<string, OrgStat>();
  if (statsRes.ok) {
    const { data } = (await statsRes.json()) as { data: OrgStat[] };
    for (const s of data) statsMap.set(s.organizationInternalId, s);
  }

  // Organizations with no donations get no stats fields at all, which is what
  // sorts them last in the table regardless of direction.
  const rows: OrganizationRow[] = orgs.map((org) => {
    const stat = statsMap.get(org.internalId);
    return {
      id: org.id,
      internalId: org.internalId,
      title: org.title,
      active: org.active,
      fund: org.fund,
      logoUrl: org.logo ? logoUrl(org.logo.url) : null,
      logoAlt: org.logo?.alternativeText ?? null,
      ...(stat && {
        totalDonated: stat.totalDonated,
        donationCount: stat.donationCount,
        ...(stat.lastDonationDate && {
          lastDonationDate: stat.lastDonationDate,
        }),
      }),
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Organizations</h1>
      <OrganizationsTable data={rows} />
    </div>
  );
}
