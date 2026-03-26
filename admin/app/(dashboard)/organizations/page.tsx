import Link from "next/link";
import { strapiAdmin } from "../../../lib/api";
import { fetchOrgs } from "../../../lib/orgs";
import { Badge } from "../../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";

type OrgStat = {
  organizationInternalId: string;
  totalDonated: number;
  donationCount: number;
  lastDonationDate: string | null;
};

// Tailwind background + text color pairs for the initial avatar
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",
];

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function logoUrl(url: string): string {
  return url.startsWith("http") ? url : `${STRAPI_URL}${url}`;
}

function formatAmount(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("et-EE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
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

  // Sort by totalDonated descending, orgs without stats go last
  const sorted = [...orgs].sort((a, b) => {
    const ta = statsMap.get(a.internalId)?.totalDonated ?? -1;
    const tb = statsMap.get(b.internalId)?.totalDonated ?? -1;
    return tb - ta;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <p className="text-sm text-muted-foreground">{orgs.length} total</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total donated</TableHead>
            <TableHead className="text-right">Donations</TableHead>
            <TableHead>Last donation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((org) => {
            const stat = statsMap.get(org.internalId);
            return (
              <TableRow key={org.id} className="cursor-pointer">
                <TableCell>
                  <Link
                    href={`/organizations/${encodeURIComponent(org.internalId)}`}
                    className="flex"
                  >
                    {org.logo ? (
                      <img
                        src={logoUrl(org.logo.url)}
                        alt={org.logo.alternativeText ?? org.title ?? ""}
                        className="h-7 w-7 rounded object-contain"
                      />
                    ) : (
                      <div
                        className={`h-7 w-7 rounded flex items-center justify-center text-xs font-semibold ${avatarColor(org.internalId)}`}
                      >
                        {(org.title ?? org.internalId).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">
                  <Link
                    href={`/organizations/${encodeURIComponent(org.internalId)}`}
                    className="hover:underline"
                  >
                    {org.title ?? "—"}
                  </Link>
                </TableCell>
                <TableCell>
                  {org.fund ? (
                    <Badge variant="secondary">Fund</Badge>
                  ) : (
                    <Badge variant="outline">Organization</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {org.active ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {stat ? formatAmount(stat.totalDonated) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {stat ? stat.donationCount : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {stat?.lastDonationDate
                    ? formatDate(stat.lastDonationDate)
                    : "—"}
                </TableCell>
              </TableRow>
            );
          })}
          {orgs.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground py-8"
              >
                No organizations found. Check that Strapi is running.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
