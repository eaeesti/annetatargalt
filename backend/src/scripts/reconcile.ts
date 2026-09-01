/**
 * Backfill / reconcile donations against an LHV bank-statement CSV.
 *
 *   yarn reconcile <bank.csv> [overrides.csv] [--apply] [--force]
 *
 *   <bank.csv>       LHV account-statement export (Estonian or English headers)
 *   [overrides.csv]  optional manual matches: header row + `donation_id,archiving_code[,note]`
 *   --apply          write transaction_id / transaction_match_source to the DB
 *                    (default: dry run — print the report and change nothing)
 *   --force          with --apply, also overwrite donations that already have a
 *                    transaction_id (default: skip them)
 *
 * The bank CSV and the overrides file contain donor data — keep them out of this
 * (public) repo. Run this on the VPS or against a copy of the prod DB.
 *
 * Reads DB config from the environment (same vars as Strapi); the `yarn reconcile`
 * script wires up `dotenv -e .env`.
 */
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { closeDatabase } from "../db/client";
import { donationsRepository } from "../db/repositories/donations.repository";
import { parseLhvCsv, matchDonations } from "../utils/reconciliation";

function parseOverrides(path: string): Map<number, string> {
  const rows: Record<string, string>[] = parse(readFileSync(path), {
    columns: true,
    bom: true,
    skipEmptyLines: true,
    trim: true,
  });
  const overrides = new Map<number, string>();
  for (const row of rows) {
    const id = Number(row.donation_id ?? row.donationId ?? row.id);
    const code = (
      row.archiving_code ??
      row.archivingCode ??
      row.code ??
      ""
    ).trim();
    if (!Number.isInteger(id) || !code) {
      throw new Error(
        `overrides: bad row ${JSON.stringify(row)} — expected columns donation_id, archiving_code`,
      );
    }
    overrides.set(id, code);
  }
  return overrides;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const force = args.includes("--force");
  const positional = args.filter((a) => !a.startsWith("--"));
  const [csvPath, overridesPath] = positional;

  if (!csvPath) {
    console.error(
      "usage: yarn reconcile <bank.csv> [overrides.csv] [--apply] [--force]",
    );
    process.exitCode = 1;
    return;
  }

  const transactions = parseLhvCsv(readFileSync(csvPath));
  const overrides = overridesPath ? parseOverrides(overridesPath) : new Map();
  const donations = await donationsRepository.findForReconciliation();

  const report = matchDonations(transactions, donations, overrides);

  const bySource = (s: string) =>
    report.matched.filter((m) => m.source === s).length;

  console.log(`\nBank CSV:        ${csvPath}`);
  console.log(
    `  transactions:  ${transactions.length} (credits with a code: ${
      transactions.filter((t) => t.direction === "C" && t.archivingCode).length
    })`,
  );
  if (overridesPath)
    console.log(`  overrides:     ${overrides.size} from ${overridesPath}`);
  console.log(`\nFinalized donations: ${donations.length}`);
  console.log(`  matched:            ${report.matched.length}`);
  console.log(`    manual:              ${bySource("manual")}`);
  console.log(`    selgitus-id:         ${bySource("selgitus-id")}`);
  console.log(`    idcode-amount-date:  ${bySource("idcode-amount-date")}`);
  console.log(`  ambiguous:          ${report.ambiguous.length}`);
  console.log(
    `  transactionless:    ${report.transactionlessDonations.length}`,
  );
  console.log(
    `\nDonationless credit transactions: ${report.donationlessTransactions.length}`,
  );

  if (report.ambiguous.length > 0) {
    console.log("\n── Ambiguous (need a manual override) ──");
    for (const a of report.ambiguous) {
      console.log(
        `  donation ${a.donationId} → ${a.candidateCodes.join(", ")}`,
      );
    }
  }

  if (report.transactionlessDonations.length > 0) {
    console.log("\n── Transactionless donations ──");
    const byId = new Map(donations.map((d) => [d.id, d]));
    for (const id of report.transactionlessDonations) {
      const d = byId.get(id);
      console.log(
        `  donation ${id}  ${d?.datetime.slice(0, 10)}  €${((d?.amountCents ?? 0) / 100).toFixed(2)}  idCode=${d?.donorIdCode ?? "—"}`,
      );
    }
  }

  if (report.donationlessTransactions.length > 0) {
    console.log("\n── Donationless credit transactions ──");
    for (const t of report.donationlessTransactions) {
      console.log(
        `  ${t.date}  €${(t.amountCents / 100).toFixed(2).padStart(9)}  ${t.archivingCode}  ${t.counterpartyName}  "${t.description}"`,
      );
    }
  }

  if (!apply) {
    console.log(
      "\nDry run — nothing written. Re-run with --apply to persist.\n",
    );
    return;
  }

  const alreadyReconciled = force
    ? new Set<number>()
    : await donationsRepository.findReconciledIds();
  const toWrite = report.matched
    .filter((m) => !alreadyReconciled.has(m.donationId))
    .map((m) => ({
      id: m.donationId,
      transactionId: m.archivingCode,
      source: m.source,
    }));
  const skipped = report.matched.length - toWrite.length;

  await donationsRepository.setTransactionIds(toWrite);
  console.log(
    `\nApplied: ${toWrite.length} donation(s) updated${skipped ? `, ${skipped} skipped (already reconciled; use --force to overwrite)` : ""}.\n`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
