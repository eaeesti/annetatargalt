import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { strapiAdmin } from "../../../../lib/api";
import { readJson } from "../../../../lib/read-json";
import { fetchOrgNameMap } from "../../../../lib/orgs";
import { Badge } from "../../../../components/ui/badge";
import { EntityLink } from "../../../../components/entity-link";
import {
  RecurringStatusBadge,
  type RecurringDonationStatus,
} from "../../../../components/recurring-status-badge";
import { organizationHref } from "../../../../lib/entity-links";
import { formatDate } from "../../../../lib/dates";
import { RememberedLink } from "../../../../components/remembered-link";

// ── Types ─────────────────────────────────────────────────────────────────────

type LinkedDonation = {
  id: number;
  datetime: string;
  amount: number;
  finalized: boolean;
  organizationDonations: { organizationInternalId: string; amount: number }[];
};

type OrgSplit = {
  id: number;
  organizationInternalId: string;
  amount: number;
};

type RecurringDonationDetail = {
  id: number;
  status: RecurringDonationStatus;
  amount: number;
  datetime: string;
  companyName: string | null;
  companyCode: string | null;
  comment: string | null;
  bank: string | null;
  createdAt: string;
  donor: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    idCode: string | null;
  };
  organizationRecurringDonations: OrgSplit[];
  donations: LinkedDonation[];
  gapMonths: string[]; // "YYYY-MM" strings
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAmount(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("et-EE", {
    year: "numeric",
    month: "long",
  });
}

function donorName(donor: RecurringDonationDetail["donor"]): string {
  if (donor.firstName && donor.lastName)
    return `${donor.firstName} ${donor.lastName}`;
  if (donor.firstName) return donor.firstName;
  if (donor.lastName) return donor.lastName;
  return donor.email ?? `Donor #${donor.id}`;
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

type Params = Promise<{ id: string }>;

// The number, not a name: tab titles end up in the browser's history.
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Recurring donation #${id}` };
}

export default async function RecurringDonationDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  const [res, orgNames] = await Promise.all([
    strapiAdmin(`/api/admin-panel/recurring-donations/${id}`, {
      cache: "no-store",
    }),
    fetchOrgNameMap(),
  ]);

  // a bad or unknown ID is "not found"; anything else is the error page,
  // whose Try again fetches it again
  if (res.status === 404 || res.status === 400) notFound();
  if (!res.ok)
    throw new Error(`Couldn't load the recurring donation (${res.status})`);

  const { data: rd } = await readJson<{ data: RecurringDonationDetail }>(res);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <RememberedLink
          href="/recurring-donations"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Recurring Donations
        </RememberedLink>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">
            Recurring #{rd.id} — {donorName(rd.donor)}
          </h1>
          <RecurringStatusBadge status={rd.status} />
        </div>
      </div>

      {/* Details */}
      <Section title="Details">
        <Field label="Monthly amount">
          <span className="font-medium">{formatAmount(rd.amount)}/mo</span>
        </Field>
        <Field label="Started">{formatDate(rd.datetime)}</Field>
        {rd.bank && <Field label="Bank">{rd.bank}</Field>}
        {rd.companyName && <Field label="Company">{rd.companyName}</Field>}
        {rd.companyCode && (
          <Field label="Company code">
            <span className="font-mono text-xs">{rd.companyCode}</span>
          </Field>
        )}
        {rd.comment && <Field label="Comment">{rd.comment}</Field>}
      </Section>

      {/* Donor */}
      <Section title="Donor">
        <Field label="Name">
          <Link
            href={`/donors/${rd.donor.id}`}
            className="text-primary hover:underline"
          >
            {donorName(rd.donor)}
          </Link>
        </Field>
        {rd.donor.email && <Field label="Email">{rd.donor.email}</Field>}
        {rd.donor.idCode && (
          <Field label="ID code">
            <span className="font-mono text-xs">{rd.donor.idCode}</span>
          </Field>
        )}
      </Section>

      {/* Org splits */}
      {rd.organizationRecurringDonations.length > 0 && (
        <Section title="Organization split">
          <div className="space-y-1">
            {rd.organizationRecurringDonations.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between text-sm"
              >
                <EntityLink href={organizationHref(o.organizationInternalId)}>
                  {orgNames.get(o.organizationInternalId) ??
                    o.organizationInternalId}
                </EntityLink>
                <span className="font-medium tabular-nums">
                  {formatAmount(o.amount)}/mo
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Gap months */}
      {rd.gapMonths.length > 0 && (
        <Section
          title={`Missing donations (${rd.gapMonths.length} gap${rd.gapMonths.length !== 1 ? "s" : ""})`}
        >
          <p className="text-xs text-muted-foreground">
            Months with no finalized linked donation:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {rd.gapMonths.map((ym) => (
              <Badge
                key={ym}
                variant="destructive"
                className="text-xs font-normal"
              >
                {formatMonth(ym)}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {/* Linked donations */}
      {rd.donations.length > 0 && (
        <Section title={`Linked donations (${rd.donations.length})`}>
          <div className="space-y-2">
            {rd.donations.map((d) => (
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
                  {d.finalized ? (
                    <Badge variant="default" className="text-xs">
                      Finalized
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Pending
                    </Badge>
                  )}
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  {d.organizationDonations.length > 0 && (
                    <span className="hidden max-w-48 truncate text-xs text-muted-foreground sm:block">
                      {d.organizationDonations
                        .map(
                          (od) =>
                            orgNames.get(od.organizationInternalId) ??
                            od.organizationInternalId,
                        )
                        .join(", ")}
                    </span>
                  )}
                  <span className="font-medium tabular-nums">
                    {formatAmount(d.amount)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
