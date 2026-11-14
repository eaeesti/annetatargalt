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
import { recurringDonationHref } from "../../../../lib/entity-links";
import { formatDate } from "../../../../lib/dates";
import { BackLink } from "../../../../components/back-link";
import {
  EmailPreferences,
  type EmailLocale,
} from "./_components/email-preferences";

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
  // Absent from a backend older than this page: the two deploy separately.
  newsletter?: boolean;
  transferEmails?: boolean;
  yearlyEmails?: boolean;
  emailLocale?: EmailLocale;
  newsletterSource?: string;
  emailPreferencesUpdatedAt?: string | null;
  emailPreferencesUrl?: string;
  donations: DonationSummary[];
  recurringDonations: {
    id: number;
    amount: number;
    // Absent from a backend older than this page: the two deploy separately.
    status?: RecurringDonationStatus;
  }[];
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

/**
 * Who set the address's newsletter setting as it is: the donor, a donation
 * form's choice, or no one since it was on by default.
 */
function newsletterSet(source: string) {
  if (source === "settings") {
    return "In their settings, or by the team when they asked";
  }
  if (source === "donation") return "With the choice on a donation form";
  if (source === "existing-donor") {
    return "On from the start: they had given before there was a newsletter";
  }
  return "On by default";
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
  return { title: `Donor #${id}` };
}

export default async function DonorDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const [res, orgNames] = await Promise.all([
    strapiAdmin(`/api/admin-panel/donors/${id}`, { cache: "no-store" }),
    fetchOrgNameMap(),
  ]);

  // a bad or unknown ID is "not found"; anything else is the error page,
  // whose Try again fetches it again
  if (res.status === 404 || res.status === 400) notFound();
  if (!res.ok) throw new Error(`Couldn't load the donor (${res.status})`);

  const { data: donor } = await readJson<{ data: DonorDetail }>(res);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <BackLink href="/donors">Donors</BackLink>
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

      {/* Emails */}
      {typeof donor.newsletter === "boolean" &&
        typeof donor.transferEmails === "boolean" &&
        typeof donor.yearlyEmails === "boolean" && (
          <Section title="Emails">
            <EmailPreferences
              donorId={donor.id}
              preferences={{
                newsletter: donor.newsletter,
                transferEmails: donor.transferEmails,
                yearlyEmails: donor.yearlyEmails,
              }}
              emailLocale={donor.emailLocale}
            />
            {donor.newsletterSource && (
              <Field label="Newsletter set">
                {newsletterSet(donor.newsletterSource)}
              </Field>
            )}
            {donor.emailPreferencesUpdatedAt && (
              <Field label="Last changed">
                {formatDate(donor.emailPreferencesUpdatedAt, true)}
              </Field>
            )}
            {donor.emailPreferencesUrl && (
              <Field label="Their settings page">
                <a
                  href={donor.emailPreferencesUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  Open as the donor
                </a>
              </Field>
            )}
          </Section>
        )}

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
                <EntityLink href={recurringDonationHref(rd.id)}>
                  #{rd.id}
                </EntityLink>
                <span className="tabular-nums">
                  {formatAmount(rd.amount)}/mo
                </span>
                {rd.status && <RecurringStatusBadge status={rd.status} />}
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
