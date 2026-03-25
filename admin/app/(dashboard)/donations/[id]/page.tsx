import Link from "next/link";
import { notFound } from "next/navigation";
import { strapiAdmin } from "../../../../lib/api";
import { resolveOrgNames } from "../../../../lib/orgs";
import { Badge } from "../../../../components/ui/badge";

// ── Types ─────────────────────────────────────────────────────────────────────

type DonationDetail = {
  id: number;
  datetime: string;
  amount: number;
  finalized: boolean;
  paymentMethod: string | null;
  iban: string | null;
  comment: string | null;
  externalDonation: boolean;
  companyName: string | null;
  companyCode: string | null;
  dedicationName: string | null;
  dedicationEmail: string | null;
  dedicationMessage: string | null;
  donorId: number | null;
  recurringDonationId: number | null;
  donationTransferId: number | null;
  donor: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    idCode: string | null;
  } | null;
  organizationDonations: {
    organizationInternalId: string;
    amount: number;
  }[];
  recurringDonation: { id: number } | null;
  donationTransfer: {
    id: number;
    datetime: string;
    recipient: string | null;
  } | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAmount(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("et-EE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function donorName(donor: DonationDetail["donor"]): string | null {
  if (!donor) return null;
  if (donor.firstName && donor.lastName)
    return `${donor.firstName} ${donor.lastName}`;
  return donor.email ?? null;
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

export default async function DonationDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  const res = await strapiAdmin(`/api/admin-panel/donations/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) notFound();

  const { data: donation } = (await res.json()) as { data: DonationDetail };

  const orgIds = donation.organizationDonations.map(
    (od) => od.organizationInternalId,
  );
  const orgNames = await resolveOrgNames(orgIds);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/donations"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Donations
        </Link>
        <h1 className="text-2xl font-bold">Donation #{donation.id}</h1>
      </div>

      {/* Key details */}
      <Section title="Details">
        <Field label="Amount">{formatAmount(donation.amount)}</Field>
        <Field label="Date">{formatDate(donation.datetime)}</Field>
        <Field label="Status">
          {donation.finalized ? (
            <Badge variant="default">Finalized</Badge>
          ) : (
            <Badge variant="secondary">Pending</Badge>
          )}
        </Field>
        {donation.paymentMethod && (
          <Field label="Payment method">{donation.paymentMethod}</Field>
        )}
        {donation.iban && (
          <Field label="IBAN">
            <span className="font-mono text-xs">{donation.iban}</span>
          </Field>
        )}
        {donation.comment && <Field label="Comment">{donation.comment}</Field>}
        {donation.externalDonation && (
          <Field label="External">
            <Badge variant="outline">External</Badge>
          </Field>
        )}
        {donation.donationTransfer && (
          <Field label="Transfer">#{donation.donationTransfer.id}</Field>
        )}
        {donation.recurringDonation && (
          <Field label="Recurring donation">
            #{donation.recurringDonation.id}
          </Field>
        )}
      </Section>

      {/* Donor */}
      {donation.donor && (
        <Section title="Donor">
          <Field label="Name">{donorName(donation.donor) ?? "—"}</Field>
          {donation.donor.email && (
            <Field label="Email">{donation.donor.email}</Field>
          )}
          {donation.donor.idCode && (
            <Field label="ID code">
              <span className="font-mono text-xs">{donation.donor.idCode}</span>
            </Field>
          )}
        </Section>
      )}

      {/* Company (conditional) */}
      {(donation.companyName || donation.companyCode) && (
        <Section title="Company">
          {donation.companyName && (
            <Field label="Company name">{donation.companyName}</Field>
          )}
          {donation.companyCode && (
            <Field label="Company code">
              <span className="font-mono text-xs">{donation.companyCode}</span>
            </Field>
          )}
        </Section>
      )}

      {/* Dedication (conditional) */}
      {(donation.dedicationName ||
        donation.dedicationEmail ||
        donation.dedicationMessage) && (
        <Section title="Dedication">
          {donation.dedicationName && (
            <Field label="Name">{donation.dedicationName}</Field>
          )}
          {donation.dedicationEmail && (
            <Field label="Email">{donation.dedicationEmail}</Field>
          )}
          {donation.dedicationMessage && (
            <Field label="Message">{donation.dedicationMessage}</Field>
          )}
        </Section>
      )}

      {/* Organization split */}
      {donation.organizationDonations.length > 0 && (
        <Section title="Organization split">
          <div className="space-y-2">
            {donation.organizationDonations.map((od) => (
              <div
                key={od.organizationInternalId}
                className="flex justify-between text-sm"
              >
                <span>
                  {orgNames.get(od.organizationInternalId) ??
                    od.organizationInternalId}
                </span>
                <span className="font-medium tabular-nums">
                  {formatAmount(od.amount)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
