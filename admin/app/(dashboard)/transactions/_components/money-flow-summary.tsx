"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "../../../../components/ui/card";

export type MoneyFlow = {
  dateFrom: string | null;
  dateTo: string | null;
  received: number;
  cardPayoutNet: number;
  cardPayoutGross: number;
  cardFees: number;
  cardFeesFromDonations: number;
  allocated: number;
  transferred: number;
  undecidedInflow: number;
  outgoingTotal: number;
  unimportedRows: number;
  unlinkedDonationCount: number;
  unlinkedDonationCents: number;
  discrepancy: number;
};

const eur = (cents: number) =>
  `€${(cents / 100).toLocaleString("et-EE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function Figure({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "muted" | "warn" | "bad";
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          "text-lg font-semibold tabular-nums " +
          (tone === "bad"
            ? "text-destructive"
            : tone === "warn"
              ? "text-amber-600"
              : tone === "muted"
                ? "text-muted-foreground"
                : "")
        }
      >
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function MoneyFlowSummary({ summary: s }: { summary: MoneyFlow }) {
  const sp = useSearchParams();
  const range =
    s.dateFrom || s.dateTo
      ? `${s.dateFrom ?? "…"} → ${s.dateTo ?? "…"}`
      : "all time";

  const feeMismatch = Math.abs(s.cardFees - s.cardFeesFromDonations);
  const discrepancyBad = Math.abs(s.discrepancy) > 100; // > €1

  const listHref = (category: string) => {
    const p = new URLSearchParams(sp.toString());
    p.set("category", category);
    p.delete("page");
    return `/transactions?${p.toString()}`;
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Money flow</h2>
          <span className="text-xs text-muted-foreground">{range}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Figure label="Received (bank transfers)" value={eur(s.received)} />
          <Figure
            label="Card payouts (net)"
            value={eur(s.cardPayoutNet)}
            hint={`gross ${eur(s.cardPayoutGross)}`}
          />
          <Figure
            label="Card fees"
            value={eur(s.cardFees)}
            tone={feeMismatch > 100 ? "warn" : undefined}
            hint={
              feeMismatch > 100
                ? `per-donation Σ ${eur(s.cardFeesFromDonations)}`
                : undefined
            }
          />
          <Figure
            label="Allocated to orgs"
            value={eur(s.allocated)}
            hint="Σ organization splits"
          />
          <Figure
            label="Transferred onward"
            value={eur(s.transferred)}
            hint={`float ${eur(s.allocated - s.transferred)}`}
          />
          <Figure
            label="Outgoing (bank debits)"
            value={eur(s.outgoingTotal)}
            tone="muted"
            hint="all debit lines"
          />
          <Figure
            label="Discrepancy"
            value={eur(s.discrepancy)}
            tone={discrepancyBad ? "bad" : "muted"}
            hint="allocated − (received + card net + fees)"
          />
        </div>

        {(s.undecidedInflow > 0 ||
          s.unlinkedDonationCount > 0 ||
          s.unimportedRows > 0) && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-xs">
            {s.unimportedRows > 0 && (
              <Link
                href={listHref("unimported")}
                className="text-muted-foreground hover:underline"
              >
                {s.unimportedRows} code
                {s.unimportedRows === 1 ? "" : "s"} whose bank line isn&apos;t
                imported yet — re-import that period to include them
              </Link>
            )}
            {s.undecidedInflow > 0 && (
              <Link
                href={listHref("undecided")}
                className="text-amber-600 hover:underline"
              >
                {eur(s.undecidedInflow)} undecided inflow — not yet classified
              </Link>
            )}
            {s.unlinkedDonationCount > 0 && (
              <Link
                href="/donations?hasTransactionId=false"
                className="text-amber-600 hover:underline"
              >
                {s.unlinkedDonationCount} finalized donation
                {s.unlinkedDonationCount === 1 ? "" : "s"} with no bank line (
                {eur(s.unlinkedDonationCents)})
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
