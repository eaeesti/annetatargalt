import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { strapiAdmin } from "../../../../lib/api";
import { readJson } from "../../../../lib/read-json";
import { fetchOrgNameMap } from "../../../../lib/orgs";
import { formatEuros } from "../../../../lib/money";
import { TransferReconciliation } from "../_components/transfer-reconciliation";
import { TransferMetaEditor } from "../_components/transfer-meta-editor";
import { TransferDonationsEditor } from "../_components/transfer-donations-editor";
import { CardFeeSwitch } from "../_components/card-fee-switch";
import { formatDate } from "../../../../lib/dates";
import { BackLink } from "../../../../components/back-link";

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
  transactionId: string | null;
  processorFeeCents: number | null;
  organizationDonations: { organizationInternalId: string; amount: number }[];
};

type LinkedPayment = {
  archivingCode: string;
  date: string | null;
  amountCents: number | null;
  counterpartyName: string | null;
  description: string | null;
  note: string | null;
  file: {
    id: number;
    fileName: string;
    sizeBytes: number;
    uploadedAt: string;
  } | null;
};

type TransferDetail = {
  id: number;
  datetime: string;
  notes: string | null;
  createdAt: string;
  donations: LinkedDonation[];
  orgTotals: OrgTotal[];
  /** owed to orgs, after the card fee deduction */
  owedCents: number;
  deductCardFees: boolean;
  tipOrganizationInternalId: string | null;
  cardFeeCents: number;
  /** what comes off the tip organization's share for card fees */
  cardFeeDeductionCents: number;
  /** card fees beyond the tip organization's share, left undeducted */
  cardFeesNotDeductedCents: number;
  /** card donations whose payout fee isn't known yet */
  donationsWithUnknownFee: number;
  paidOutCents: number;
  adjustmentCents: number | null;
  reconciliationNote: string | null;
  residualCents: number;
  balanced: boolean | null;
  linkedBankTransactions: LinkedPayment[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  return { title: `Transfer #${id}` };
}

export default async function TransferDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  const [res, orgNames] = await Promise.all([
    strapiAdmin(`/api/admin-panel/transfers/${id}`, { cache: "no-store" }),
    fetchOrgNameMap(),
  ]);

  // a bad or unknown ID is "not found"; anything else is the error page,
  // whose Try again fetches it again
  if (res.status === 404 || res.status === 400) notFound();
  if (!res.ok) throw new Error(`Couldn't load the transfer (${res.status})`);

  const { data: transfer } = await readJson<{ data: TransferDetail }>(res);

  // What goes out: the organizations' shares, less the card fees taken off
  // the tip organization's share when the round deducts them.
  const tipId = transfer.tipOrganizationInternalId;
  const tipName = tipId ? (orgNames.get(tipId) ?? tipId) : null;
  const deductionOf = (internalId: string) =>
    internalId === tipId ? transfer.cardFeeDeductionCents : 0;
  const grandTotal =
    transfer.orgTotals.reduce((s, o) => s + o.total, 0) -
    transfer.cardFeeDeductionCents;
  const finalizedDonations = transfer.donations.filter((d) => d.finalized);
  const reconciledCount = transfer.donations.filter(
    (d) => d.transactionId,
  ).length;
  // A fee is only on record once a statement import has matched the donation
  // to a card payout, so "none recorded" is not the same as €0.00.
  const fees = finalizedDonations
    .map((d) => d.processorFeeCents)
    .filter((fee) => typeof fee === "number");
  const feeTotal = fees.reduce((s, fee) => s + fee, 0);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <BackLink href="/transfers">Transfers</BackLink>
        <h1 className="text-2xl font-bold">
          Transfer #{transfer.id} — {formatDate(transfer.datetime)}
        </h1>
      </div>

      {/* Metadata */}
      <Section title="Details">
        <Field label="Date">{formatDate(transfer.datetime)}</Field>
        {transfer.notes && <Field label="Notes">{transfer.notes}</Field>}
        <Field label="Donations">
          <span>
            {transfer.donations.length}
            {transfer.donations.length !== finalizedDonations.length && (
              <span className="ml-1 text-destructive">
                ({transfer.donations.length - finalizedDonations.length} not
                finalized)
              </span>
            )}
          </span>
        </Field>
        <Field label="Total transferred">
          <span className="font-medium">{formatEuros(grandTotal)}</span>
        </Field>
        <Field label="Card fees">
          <span className="block space-y-1">
            {fees.length > 0 ? (
              <span className="block">
                {formatEuros(feeTotal)}
                <span className="ml-2 text-muted-foreground">
                  (from {fees.length} donation{fees.length !== 1 ? "s" : ""})
                </span>
              </span>
            ) : (
              <span className="block text-muted-foreground">None recorded</span>
            )}
            {/* no fees, and none still to come: nothing to take off */}
            {tipName &&
              (feeTotal > 0 || transfer.donationsWithUnknownFee > 0) && (
                <CardFeeSwitch
                  transferId={transfer.id}
                  deductCardFees={transfer.deductCardFees}
                  tipOrganizationName={tipName}
                />
              )}
            {transfer.cardFeesNotDeductedCents > 0 && (
              <span className="block text-xs text-destructive">
                {formatEuros(transfer.cardFeesNotDeductedCents)} of the fees is
                more than {tipName}&apos;s share, so it isn&apos;t deducted.
              </span>
            )}
            {transfer.donationsWithUnknownFee > 0 && (
              <span className="block text-xs text-amber-700 dark:text-amber-400">
                {transfer.donationsWithUnknownFee} card donation
                {transfer.donationsWithUnknownFee !== 1 ? "s" : ""} came in a
                Montonio payout whose fee isn&apos;t known yet. The next
                statement import works it out.
              </span>
            )}
          </span>
        </Field>
        <div className="pt-1">
          <TransferMetaEditor
            transferId={transfer.id}
            datetime={transfer.datetime}
            notes={transfer.notes}
          />
        </div>
      </Section>

      {/* Reconciliation — owed to orgs vs actually paid out */}
      <TransferReconciliation
        transferId={transfer.id}
        transferDate={transfer.datetime}
        owedCents={transfer.owedCents}
        paidOutCents={transfer.paidOutCents}
        adjustmentCents={transfer.adjustmentCents}
        reconciliationNote={transfer.reconciliationNote}
        residualCents={transfer.residualCents}
        balanced={transfer.balanced}
        linked={transfer.linkedBankTransactions}
      />

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
              const deduction = deductionOf(o.organizationInternalId);
              const total = o.total - deduction;
              const pct =
                grandTotal > 0
                  ? ((total / grandTotal) * 100).toFixed(1)
                  : "0.0";
              return (
                <div key={o.organizationInternalId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <a
                      href={`/organizations/${encodeURIComponent(o.organizationInternalId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                    >
                      {name}
                    </a>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {o.donationCount} donation
                        {o.donationCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-right">
                        <span className="block font-semibold tabular-nums">
                          {formatEuros(total)}
                        </span>
                        {deduction > 0 && (
                          <span className="block text-xs text-muted-foreground tabular-nums">
                            {formatEuros(o.total)} − {formatEuros(deduction)}{" "}
                            card fees
                          </span>
                        )}
                      </span>
                      <span className="w-10 text-right text-xs text-muted-foreground">
                        {pct}%
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {/* Grand total row */}
            <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm">
              <span className="font-semibold">Total</span>
              <span className="font-semibold tabular-nums">
                {formatEuros(grandTotal)}
              </span>
            </div>
          </div>
        </Section>
      )}

      {/* Donations list — editable */}
      <Section
        title={`Included donations (${transfer.donations.length}${
          transfer.donations.length > 0 &&
          reconciledCount < transfer.donations.length
            ? `, ${reconciledCount} reconciled`
            : ""
        })`}
      >
        <TransferDonationsEditor
          key={transfer.id}
          transferId={transfer.id}
          transferDate={transfer.datetime}
          donations={transfer.donations.map((d) => ({
            id: d.id,
            datetime: d.datetime,
            amount: d.amount,
            finalized: d.finalized,
            transactionId: d.transactionId,
            processorFeeCents: d.processorFeeCents,
            orgLabel: d.organizationDonations
              .map(
                (od) =>
                  orgNames.get(od.organizationInternalId) ??
                  od.organizationInternalId,
              )
              .join(", "),
          }))}
        />
      </Section>
    </div>
  );
}
