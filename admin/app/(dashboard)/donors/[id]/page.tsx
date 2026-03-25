import Link from "next/link";
import { notFound } from "next/navigation";
import { strapiAdmin } from "../../../../lib/api";
import { resolveOrgNames } from "../../../../lib/orgs";
import { Badge } from "../../../../components/ui/badge";

// ── Types ─────────────────────────────────────────────────────────────────────

type DonationSummary = {
  id: number;
  datetime: string;
  amount: number;
  finalized: boolean;
  paymentMethod: string | null;
  organizationDonations: { organizationInternalId: string; amount: number }[];
};

type DonorDetail = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  idCode: string | null;
  recurringDonor: boolean | null;
  createdAt: string;
  donations: DonationSummary[];
  recurringDonations: { id: number; active: boolean; amount: number }[];
  stats: {
    totalDonated: number;
    donationCount: number;
    firstDonationDate: string | null;
    lastDonationDate: string | null;
  };
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

function donorName(donor: DonorDetail): string {
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

export default async function DonorDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const res = await strapiAdmin(`/api/admin-panel/donors/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) notFound();

  const { data: donor } = (await res.json()) as { data: DonorDetail };

  // Resolve org names for all donations
  const allOrgIds = [
    ...new Set(
      donor.donations.flatMap((d) =>
        d.organizationDonations.map((od) => od.organizationInternalId),
      ),
    ),
  ];
  const orgNames = await resolveOrgNames(allOrgIds);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/donors"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Donors
        </Link>
        <h1 className="text-2xl font-bold">{donorName(donor)}</h1>
      </div>

      {/* Donor info */}
      <Section title="Donor">
        {donor.firstName && <Field label="First name">{donor.firstName}</Field>}
        {donor.lastName && <Field label="Last name">{donor.lastName}</Field>}
        {donor.email && <Field label="Email">{donor.email}</Field>}
        {donor.idCode && (
          <Field label="ID code">
            <span className="font-mono text-xs">{donor.idCode}</span>
          </Field>
        )}
        <Field label="Recurring">
          {donor.recurringDonor ? <Badge variant="default">Yes</Badge> : "No"}
        </Field>
        <Field label="Member since">{formatDate(donor.createdAt)}</Field>
      </Section>

      {/* Stats */}
      <Section title="Stats">
        <Field label="Total donated">
          <span className="font-medium">
            {formatAmount(donor.stats.totalDonated)}
          </span>
        </Field>
        <Field label="Finalized donations">
          <span>{donor.stats.donationCount}</span>
        </Field>
        {donor.stats.firstDonationDate && (
          <Field label="First donation">
            {formatDate(donor.stats.firstDonationDate)}
          </Field>
        )}
        {donor.stats.lastDonationDate && (
          <Field label="Last donation">
            {formatDate(donor.stats.lastDonationDate)}
          </Field>
        )}
      </Section>

      {/* Recurring donations */}
      {donor.recurringDonations.length > 0 && (
        <Section title="Recurring donations">
          <div className="space-y-2">
            {donor.recurringDonations.map((rd) => (
              <div
                key={rd.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">#{rd.id}</span>
                <span className="tabular-nums">
                  {formatAmount(rd.amount)}/mo
                </span>
                {rd.active ? (
                  <Badge variant="default">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Donations list */}
      {donor.donations.length > 0 && (
        <Section title={`All donations (${donor.donations.length})`}>
          <div className="space-y-2">
            {donor.donations.map((d) => (
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
