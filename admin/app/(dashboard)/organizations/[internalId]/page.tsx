import Link from "next/link";
import { notFound } from "next/navigation";
import { strapiAdmin } from "../../../../lib/api";
import { fetchOrgs } from "../../../../lib/orgs";
import { Badge } from "../../../../components/ui/badge";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";

// ── Types ─────────────────────────────────────────────────────────────────────

type OrgStat = {
  organizationInternalId: string;
  totalDonated: number;
  donationCount: number;
  lastDonationDate: string | null;
};

type DonationRow = {
  id: number;
  datetime: string;
  amount: number;
  finalized: boolean;
  donorId: number | null;
  organizationDonations: { organizationInternalId: string; amount: number }[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAmount(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string, includeTime = false): string {
  return new Date(iso).toLocaleDateString("et-EE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function logoUrl(url: string): string {
  return url.startsWith("http") ? url : `${STRAPI_URL}${url}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Params = Promise<{ internalId: string }>;

export default async function OrganizationDetailPage({
  params,
}: {
  params: Params;
}) {
  const { internalId: rawId } = await params;
  const internalId = decodeURIComponent(rawId);

  // Fetch in parallel: all orgs (to find this one), stats, recent donations
  const [orgs, statsRes, donationsRes] = await Promise.all([
    fetchOrgs(),
    strapiAdmin("/api/admin-panel/organizations/stats", { cache: "no-store" }),
    strapiAdmin(
      `/api/admin-panel/donations/list?orgId=${encodeURIComponent(internalId)}&finalized=true&sortBy=datetime&sortDir=desc&pageSize=50`,
      { cache: "no-store" },
    ),
  ]);

  const org = orgs.find((o) => o.internalId === internalId);
  if (!org) notFound();

  let stat: OrgStat | undefined;
  if (statsRes.ok) {
    const { data } = (await statsRes.json()) as { data: OrgStat[] };
    stat = data.find((s) => s.organizationInternalId === internalId);
  }

  let donations: DonationRow[] = [];
  let totalDonations = 0;
  if (donationsRes.ok) {
    const json = (await donationsRes.json()) as {
      data: DonationRow[];
      pagination: { total: number };
    };
    donations = json.data;
    totalDonations = json.pagination.total;
  }

  const displayName = org.title ?? org.internalId;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/organizations"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Organizations
        </Link>
        <div className="flex items-center gap-3">
          {org.logo ? (
            <img
              src={logoUrl(org.logo.url)}
              alt={org.logo.alternativeText ?? displayName}
              className="h-10 w-10 rounded object-contain"
            />
          ) : null}
          <h1 className="text-2xl font-bold">{displayName}</h1>
          {org.fund ? (
            <Badge variant="secondary">Fund</Badge>
          ) : (
            <Badge variant="outline">Organization</Badge>
          )}
          {org.active ? (
            <Badge variant="default">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </div>
      </div>

      {/* Info */}
      <Section title="Info">
        <Field label="Internal ID">
          <span className="font-mono text-xs">{org.internalId}</span>
        </Field>
        {org.homepage && (
          <Field label="Website">
            <a
              href={org.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              {org.homepage.replace(/^https?:\/\//, "")}
            </a>
          </Field>
        )}
      </Section>

      {/* Stats */}
      {stat && (
        <Section title="Stats">
          <Field label="Total donated">
            <span className="font-medium">
              {formatAmount(stat.totalDonated)}
            </span>
          </Field>
          <Field label="Finalized donations">
            <span>{stat.donationCount}</span>
          </Field>
          {stat.lastDonationDate && (
            <Field label="Last donation">
              {formatDate(stat.lastDonationDate)}
            </Field>
          )}
        </Section>
      )}

      {/* Recent donations */}
      {donations.length > 0 && (
        <Section
          title={`Recent donations${totalDonations > 50 ? ` (showing 50 of ${totalDonations})` : ` (${donations.length})`}`}
        >
          <div className="space-y-2">
            {donations.map((d) => {
              const orgSplit = d.organizationDonations.find(
                (od) => od.organizationInternalId === internalId,
              );
              return (
                <Link
                  key={d.id}
                  href={`/donations/${d.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 -mx-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground w-14">
                      #{d.id}
                    </span>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {formatDate(d.datetime, true)}
                    </span>
                    <Badge variant="default" className="text-xs">
                      Finalized
                    </Badge>
                  </div>
                  <span className="font-medium tabular-nums">
                    {orgSplit
                      ? formatAmount(orgSplit.amount)
                      : formatAmount(d.amount)}
                  </span>
                </Link>
              );
            })}
          </div>
          {totalDonations > 50 && (
            <div className="pt-2 border-t">
              <Link
                href={`/donations?orgId=${encodeURIComponent(internalId)}&finalized=true&sortBy=datetime&sortDir=desc`}
                className="text-sm text-primary hover:underline"
              >
                See all {totalDonations} donations →
              </Link>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
