import Link from "next/link";
import { notFound } from "next/navigation";
import { strapiAdmin } from "../../../../lib/api";
import { resolveOrgNames } from "../../../../lib/orgs";
import { Badge } from "../../../../components/ui/badge";

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
  active: boolean;
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

function formatDate(iso: string, includeTime = false): string {
  return new Date(iso).toLocaleDateString("et-EE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
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

type Params = Promise<{ id: string }>;

export default async function RecurringDonationDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  const res = await strapiAdmin(`/api/admin-panel/recurring-donations/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) notFound();

  const { data: rd } = (await res.json()) as { data: RecurringDonationDetail };

  // Resolve org names for org splits and linked donations
  const allOrgIds = [
    ...new Set([
      ...rd.organizationRecurringDonations.map((o) => o.organizationInternalId),
      ...rd.donations.flatMap((d) =>
        d.organizationDonations.map((od) => od.organizationInternalId),
      ),
    ]),
  ];
  const orgNames = await resolveOrgNames(allOrgIds);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/recurring-donations"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Recurring Donations
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">
            Recurring #{rd.id} — {donorName(rd.donor)}
          </h1>
          {rd.active ? (
            <Badge variant="default">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
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
            className="hover:underline text-primary"
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
                <span className="text-muted-foreground">
                  {orgNames.get(o.organizationInternalId) ??
                    o.organizationInternalId}
                </span>
                <span className="tabular-nums font-medium">
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
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 -mx-2"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground w-14">
                    #{d.id}
                  </span>
                  <span className="text-muted-foreground whitespace-nowrap">
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
                <div className="flex items-center gap-3">
                  {d.organizationDonations.length > 0 && (
                    <span className="text-muted-foreground text-xs hidden sm:block truncate max-w-48">
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
