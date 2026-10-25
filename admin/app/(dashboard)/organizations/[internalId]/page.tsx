import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { strapiAdmin } from "../../../../lib/api";
import { fetchOrgs } from "../../../../lib/orgs";
import { readJson } from "../../../../lib/read-json";
import { Badge } from "../../../../components/ui/badge";
import { formatDate } from "../../../../lib/dates";
import { BackLink } from "../../../../components/back-link";
import { MonthlyTotalsChart } from "../../_components/monthly-totals-chart";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";

// ── Types ─────────────────────────────────────────────────────────────────────

type OrgStat = {
  organizationInternalId: string;
  totalDonated: number;
  donationCount: number;
  lastDonationDate: string | null;
};

type MonthTotal = { month: string; total: number; count: number };

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
    <div className="space-y-3 rounded-lg border bg-card p-5">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
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

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { internalId } = await params;
  // the org list is cached, so this costs the page nothing
  const org = (await fetchOrgs()).find((o) => o.internalId === internalId);
  return { title: org?.title ?? internalId };
}

export default async function OrganizationDetailPage({
  params,
}: {
  params: Params;
}) {
  const { internalId: rawId } = await params;
  const internalId = decodeURIComponent(rawId);

  // Fetch in parallel: all orgs (to find this one), stats, monthly totals,
  // recent donations
  const [orgs, statsRes, monthlyRes, donationsRes] = await Promise.all([
    fetchOrgs(),
    strapiAdmin("/api/admin-panel/organizations/stats", { cache: "no-store" }),
    strapiAdmin(
      `/api/admin-panel/organizations/${encodeURIComponent(internalId)}/monthly-totals`,
      { cache: "no-store" },
    ),
    strapiAdmin(
      `/api/admin-panel/donations/list?orgId=${encodeURIComponent(internalId)}&finalized=true&sortBy=datetime&sortDir=desc&pageSize=50`,
      { cache: "no-store" },
    ),
  ]);

  const org = orgs.find((o) => o.internalId === internalId);
  if (!org) notFound();

  let stat: OrgStat | undefined;
  if (statsRes.ok) {
    const { data } = await readJson<{ data: OrgStat[] }>(statsRes);
    stat = data.find((s) => s.organizationInternalId === internalId);
  }

  let monthlyTotals: MonthTotal[] = [];
  if (monthlyRes.ok) {
    monthlyTotals = (await readJson<{ data: MonthTotal[] }>(monthlyRes)).data;
  }

  let donations: DonationRow[] = [];
  let totalDonations = 0;
  if (donationsRes.ok) {
    const json = await readJson<{
      data: DonationRow[];
      pagination: { total: number };
    }>(donationsRes);
    donations = json.data;
    totalDonations = json.pagination.total;
  }

  const displayName = org.title ?? org.internalId;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="space-y-2.5">
        <BackLink href="/organizations">Organizations</BackLink>
        <div className="flex items-center gap-3">
          {org.logo?.file ? (
            // oxlint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl(org.logo.file.url)}
              alt={org.logo.alt ?? displayName}
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

      {monthlyTotals.length > 0 && <MonthlyTotalsChart data={monthlyTotals} />}

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
                  className="-mx-2 flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-14 font-mono text-xs text-muted-foreground">
                      #{d.id}
                    </span>
                    <span className="whitespace-nowrap text-muted-foreground">
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
            <div className="border-t pt-2">
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
