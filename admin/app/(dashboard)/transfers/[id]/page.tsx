import Link from "next/link";
import { notFound } from "next/navigation";
import { strapiAdmin } from "../../../../lib/api";
import { resolveOrgNames } from "../../../../lib/orgs";
import { Badge } from "../../../../components/ui/badge";

// ── Types ─────────────────────────────────────────────────────────────────────

type OrgTotal = {
  organizationInternalId: string;
  total: number;
  donationCount: number;
};

type LinkedDonation = {
  id: number;
  datetime: string;
  amount: number;
  finalized: boolean;
  donorId: number | null;
  organizationDonations: { organizationInternalId: string; amount: number }[];
};

type TransferDetail = {
  id: number;
  datetime: string;
  recipient: string | null;
  notes: string | null;
  createdAt: string;
  donations: LinkedDonation[];
  orgTotals: OrgTotal[];
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

export default async function TransferDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  const res = await strapiAdmin(`/api/admin-panel/transfers/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) notFound();

  const { data: transfer } = (await res.json()) as { data: TransferDetail };

  // Resolve org names for per-org totals and donation splits
  const allOrgIds = [
    ...new Set([
      ...transfer.orgTotals.map((o) => o.organizationInternalId),
      ...transfer.donations.flatMap((d) =>
        d.organizationDonations.map((od) => od.organizationInternalId),
      ),
    ]),
  ];
  const orgNames = await resolveOrgNames(allOrgIds);

  const grandTotal = transfer.orgTotals.reduce((s, o) => s + o.total, 0);
  const finalizedDonations = transfer.donations.filter((d) => d.finalized);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/transfers"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Transfers
        </Link>
        <h1 className="text-2xl font-bold">
          Transfer #{transfer.id} — {formatDate(transfer.datetime)}
        </h1>
      </div>

      {/* Metadata */}
      <Section title="Details">
        <Field label="Date">{formatDate(transfer.datetime)}</Field>
        {transfer.recipient && (
          <Field label="Recipient">{transfer.recipient}</Field>
        )}
        {transfer.notes && <Field label="Notes">{transfer.notes}</Field>}
        <Field label="Donations">
          <span>
            {finalizedDonations.length} finalized
            {transfer.donations.length !== finalizedDonations.length && (
              <span className="text-muted-foreground ml-1">
                ({transfer.donations.length - finalizedDonations.length}{" "}
                pending)
              </span>
            )}
          </span>
        </Field>
        <Field label="Total transferred">
          <span className="font-medium">{formatAmount(grandTotal)}</span>
        </Field>
      </Section>

      {/* Per-org totals — the key output */}
      {transfer.orgTotals.length > 0 && (
        <Section
          title={`Organization totals (${transfer.orgTotals.length} org${transfer.orgTotals.length !== 1 ? "s" : ""})`}
        >
          <div className="space-y-2">
            {transfer.orgTotals.map((o) => {
              const name =
                orgNames.get(o.organizationInternalId) ??
                o.organizationInternalId;
              const pct =
                grandTotal > 0
                  ? ((o.total / grandTotal) * 100).toFixed(1)
                  : "0.0";
              return (
                <div key={o.organizationInternalId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-xs">
                        {o.donationCount} donation
                        {o.donationCount !== 1 ? "s" : ""}
                      </span>
                      <span className="tabular-nums font-semibold">
                        {formatAmount(o.total)}
                      </span>
                      <span className="text-muted-foreground text-xs w-10 text-right">
                        {pct}%
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {/* Grand total row */}
            <div className="flex items-center justify-between text-sm border-t pt-2 mt-2">
              <span className="font-semibold">Total</span>
              <span className="tabular-nums font-semibold">
                {formatAmount(grandTotal)}
              </span>
            </div>
          </div>
        </Section>
      )}

      {/* Donations list */}
      {transfer.donations.length > 0 && (
        <Section title={`Included donations (${transfer.donations.length})`}>
          <div className="space-y-2">
            {transfer.donations.map((d) => (
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
