/**
 * Backfill `gross_amount` / `fee_amount` on card-payout `bank_transactions`
 * rows that are missing them — older Montonio settlements the statement import
 * couldn't resolve — plus each linked donation's `processor_fee_cents` slice.
 *
 *   yarn backfill-card-fees [--apply]
 *
 * Dry run by default: prints what it would write and changes nothing.
 * `--apply` commits, in one transaction.
 *
 * For each `card-payout` row with `fee_amount IS NULL`:
 *   1. Try the Montonio payouts API — authoritative gross per order.
 *   2. Fall back to deriving from the linked donations:
 *      gross = Σ linked donation amounts, fee = gross − net.
 *   The implied fee must be plausible (0 ≤ fee ≤ 15% of gross) or the row is
 *   skipped and reported (e.g. a batch where not every donation is linked yet
 *   would produce a negative/absurd fee).
 * The fee is then split across the linked donations pro-rata by donation
 * amount, against the whole payout's gross (same rule as the statement apply).
 *
 * Run with the production environment loaded (`dotenv -e .env`, wired by the
 * `yarn backfill-card-fees` script).
 */
import { closeDatabase, db } from "../db/client";
import { BankTransactionsRepository } from "../db/repositories/bank-transactions.repository";
import { DonationsRepository } from "../db/repositories/donations.repository";
import {
  computePayoutGrossFee,
  parsePayoutUuidPrefix,
} from "../utils/statement";
import montonio, { type MontonioPayout } from "../utils/montonio";

const APPLY = process.argv.includes("--apply");

const toCents = (v: unknown) =>
  v === undefined || v === null ? NaN : Math.round(Number(v) * 100);
const eur = (c: number | null | undefined) =>
  c == null || Number.isNaN(c) ? "—" : `€${(c / 100).toFixed(2)}`;
const pct = (fee: number, gross: number) =>
  gross > 0 ? `${((fee / gross) * 100).toFixed(2)}%` : "—";

/** Trailing donation id in a Montonio merchant reference (`<prefix> <id>`). */
function refToDonationId(ref: string | undefined): number | null {
  if (!ref) return null;
  const m = /(\d+)\s*$/.exec(ref);
  return m ? Number(m[1]) : null;
}

async function montonioTotals(
  row: {
    archivingCode: string;
    description: string | null;
    amount: number | null;
  },
  list: MontonioPayout[],
): Promise<{ grossCents: number; feeCents: number } | null> {
  const prefix = row.description
    ? parsePayoutUuidPrefix(row.description)
    : null;
  const payout =
    (prefix && list.find((p) => p.uuid.toLowerCase().startsWith(prefix))) ||
    list.find((p) => toCents(p.totalAmount) === row.amount);
  if (!payout) return null;

  const orders = await montonio.getPayoutOrders(payout.uuid);
  if (!orders) return null;

  const parsed = orders.map((o) => ({
    donationId: refToDonationId(o.merchantReference ?? o.merchant_reference),
    grossCents: toCents(o.grandTotal ?? o.grand_total ?? o.amount ?? o.total),
  }));
  const { grossCents, feeCents } = computePayoutGrossFee(
    parsed,
    row.amount ?? 0,
  );
  return grossCents != null && feeCents != null
    ? { grossCents, feeCents }
    : null;
}

interface Plan {
  code: string;
  date: string | null;
  netCents: number;
  grossCents: number;
  feeCents: number;
  source: "montonio" | "derived";
  feeByDonation: { id: number; amount: number; fee: number }[];
}

async function main() {
  const bankRepo = new BankTransactionsRepository();
  const rows = await bankRepo.cardPayoutsMissingFee();

  console.log(
    `${rows.length} card-payout row(s) missing fee_amount` +
      (APPLY ? "" : "  (dry run — pass --apply to write)") +
      "\n",
  );
  if (rows.length === 0) return;

  const list = montonio.isPayoutsConfigured()
    ? await montonio.listPayouts()
    : [];
  if (list.length === 0) {
    console.log(
      "Montonio payouts API not configured / empty — deriving only.\n",
    );
  }

  const plans: Plan[] = [];
  const skipped: { code: string; reason: string }[] = [];

  for (const row of rows) {
    const net = row.amount ?? 0;
    const detail = await bankRepo.findByCodeWithDonations(row.archivingCode);
    const donations = (detail?.donations ?? []).map((d) => ({
      id: d.id,
      amount: d.amount ?? 0,
    }));
    const linkedGross = donations.reduce((s, d) => s + d.amount, 0);

    // 1. Montonio (authoritative gross)
    const m = list.length > 0 ? await montonioTotals(row, list) : null;

    // 2. derive from linked donations — reuse the same plausibility check
    //    (one synthetic order carrying the full linked gross)
    const derived =
      donations.length > 0
        ? computePayoutGrossFee(
            [{ donationId: null, grossCents: linkedGross }],
            net,
          )
        : { grossCents: null, feeCents: null };

    let grossCents: number;
    let feeCents: number;
    let source: "montonio" | "derived";
    if (m) {
      ({ grossCents, feeCents } = m);
      source = "montonio";
    } else if (derived.grossCents != null && derived.feeCents != null) {
      grossCents = derived.grossCents;
      feeCents = derived.feeCents;
      source = "derived";
    } else {
      skipped.push({
        code: row.archivingCode,
        reason:
          donations.length === 0
            ? "no linked donations and Montonio didn't resolve"
            : `implausible fee (net ${eur(net)} vs linked gross ${eur(linkedGross)}) — batch may be incompletely linked`,
      });
      continue;
    }

    // split the fee across the linked donations, pro-rata by amount, against
    // the whole payout gross (Σ slices ≈ fee only when every donation is linked)
    const feeByDonation = donations.map((d) => ({
      id: d.id,
      amount: d.amount,
      fee: grossCents > 0 ? Math.round((feeCents * d.amount) / grossCents) : 0,
    }));

    plans.push({
      code: row.archivingCode,
      date: row.date,
      netCents: net,
      grossCents,
      feeCents,
      source,
      feeByDonation,
    });
  }

  for (const p of plans) {
    const sliceSum = p.feeByDonation.reduce((s, d) => s + d.fee, 0);
    console.log(
      `${p.date ?? "??????????"}  ${p.code}  net ${eur(p.netCents)} → gross ${eur(
        p.grossCents,
      )}  fee ${eur(p.feeCents)} (${pct(p.feeCents, p.grossCents)})  [${p.source}]`,
    );
    for (const d of p.feeByDonation) {
      console.log(`    #${d.id}  ${eur(d.amount)}  fee ${eur(d.fee)}`);
    }
    if (p.feeByDonation.length > 0 && sliceSum !== p.feeCents) {
      console.log(
        `    (Σ slices ${eur(sliceSum)} ≠ payout fee ${eur(p.feeCents)} — other donations in this payout were reconciled elsewhere)`,
      );
    }
  }

  if (skipped.length > 0) {
    console.log("\nskipped:");
    for (const s of skipped) console.log(`  ${s.code}  — ${s.reason}`);
  }

  if (!APPLY) {
    console.log(
      `\n${plans.length} row(s) would be updated, ${skipped.length} skipped. Re-run with --apply to write.`,
    );
    return;
  }

  await db.transaction(async (tx) => {
    const bankRepoTx = new BankTransactionsRepository(tx);
    const donationsRepoTx = new DonationsRepository(tx);
    for (const p of plans) {
      await bankRepoTx.recordPayoutTotals(p.code, p.grossCents, p.feeCents);
      for (const d of p.feeByDonation) {
        await donationsRepoTx.setProcessorFee(d.id, d.fee);
      }
    }
  });

  console.log(
    `\nDone — ${plans.length} card-payout row(s) updated, ${skipped.length} skipped.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
